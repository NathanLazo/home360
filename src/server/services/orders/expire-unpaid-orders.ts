import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import type Stripe from "stripe";

import {
  closePendingOrder,
  voidCheckoutIntent,
  voidIntentsAfterClose,
} from "~/server/services/orders/cancel-unpaid-order";
import { restoreHeldStock } from "~/server/services/orders/stock-hold";
import {
  resolveUnpaidOrderTtlMinutes,
  unpaidOrderCutoff,
} from "~/server/services/orders/unpaid-order-ttl";
import { refundPayment } from "~/server/services/payments/escrow";
import { expireOrderCheckoutSession } from "~/server/services/payments/order-checkout-session";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const EXPIRY_BATCH_SIZE = 50;
const RECONCILE_BATCH_SIZE = 20;
const REQUEST_EXPIRY_BATCH_SIZE = 500;
/**
 * F10 review M3: a row the cron skipped or failed on waits this long before
 * it is tried again, so stuck rows go to the back instead of starving the
 * batch (same idea as `escrowReleaseAttemptedAt`).
 */
const EXPIRY_RETRY_DELAY_MILLISECONDS = 15 * 60_000;
/**
 * F10 review L2/M6: a CANCELLED order is only reconciled once the cancel that
 * produced it had time to finish its own tail (refund → restore), so the
 * sweep never races a cancel in flight.
 */
const RECONCILE_GRACE_MILLISECONDS = 10 * 60_000;
/** F10 review L10: each Stripe call is bounded; the run has a time budget. */
const STRIPE_TIMEOUT_MILLISECONDS = 8_000;
const RUN_BUDGET_MILLISECONDS = 40_000;

export type ExpireUnpaidOrdersResult = {
  /** PENDING orders cancelled with PAYMENT_EXPIRED. */
  expired: number;
  /** Orders left alone because their PaymentIntent / Session may carry money. */
  skipped: number;
  failed: number;
  /** CANCELLED orders whose held stock / refund the sweep finished (L2, M6). */
  reconciled: number;
  /** OPEN/QUOTED requests past `expiresAt` moved to EXPIRED. */
  requestsExpired: number;
  /** More due rows remain: the next run (or an immediate re-run) continues. */
  hasMore: boolean;
};

type ExpireDeps = {
  db: PrismaClient;
  /** Lazily resolved: orders without a PaymentIntent never need Stripe. */
  resolveStripe: () => Stripe;
};

type ExpiryOutcome = "expired" | "skipped" | "failed";

/**
 * D10-5 marketplace requests: OPEN/QUOTED requests whose `expiresAt` passed
 * become EXPIRED and their PENDING quotes EXPIRED (CAS on the status).
 */
async function expireDueRequests(db: PrismaClient, now: Date): Promise<number> {
  const due = await db.serviceRequest.findMany({
    where: {
      status: { in: [RequestStatus.OPEN, RequestStatus.QUOTED] },
      expiresAt: { lte: now },
    },
    select: { id: true },
    take: REQUEST_EXPIRY_BATCH_SIZE,
  });

  if (due.length === 0) {
    return 0;
  }

  const ids = due.map(({ id }) => id);

  return db.$transaction(async (tx) => {
    const expired = await tx.serviceRequest.updateMany({
      where: {
        id: { in: ids },
        status: { in: [RequestStatus.OPEN, RequestStatus.QUOTED] },
        expiresAt: { lte: now },
      },
      data: { status: RequestStatus.EXPIRED },
    });

    await tx.quote.updateMany({
      where: {
        requestId: { in: ids },
        status: QuoteStatus.PENDING,
        request: { status: RequestStatus.EXPIRED },
      },
      data: { status: QuoteStatus.EXPIRED },
    });

    return expired.count;
  });
}

/**
 * Closes one due PENDING order. The attempt is stamped first (CAS on
 * PENDING) so a skip or failure sends the row to the back of the queue (M3).
 * Stripe is settled before the transaction: the hosted Checkout Session is
 * expired (H1; `complete` means the customer paid → skip, the webhook
 * captures it) and the PaymentIntent voided (one that may carry money is
 * skipped). PaymentIntents a concurrent `createIntent` attached meanwhile are
 * removed by the close and voided after it (M2).
 */
async function expireOrder(
  deps: ExpireDeps,
  order: {
    id: string;
    customerId: string;
    checkoutSessionId: string | null;
    business: { ownerId: string };
    payment: {
      status: PaymentStatus;
      stripePaymentIntentId: string | null;
    } | null;
  },
  now: Date,
): Promise<ExpiryOutcome> {
  const stamped = await deps.db.order.updateMany({
    where: { id: order.id, status: OrderStatus.PENDING },
    data: { expiryAttemptedAt: now },
  });

  if (stamped.count === 0) {
    return "skipped";
  }

  if (order.payment && order.payment.status !== PaymentStatus.PENDING) {
    return "skipped";
  }

  const stripeOptions = { timeoutMs: STRIPE_TIMEOUT_MILLISECONDS };

  if (order.checkoutSessionId) {
    const sessionClosed = await expireOrderCheckoutSession(
      deps.resolveStripe(),
      order.checkoutSessionId,
      stripeOptions,
    );

    if (!sessionClosed.ok) {
      if (sessionClosed.code === "CONFLICT") {
        return "skipped";
      }

      console.error("[expire-unpaid-orders] SESSION_EXPIRE_FAILED", {
        orderId: order.id,
        code: sessionClosed.code,
      });

      return "failed";
    }
  }

  const intentId = order.payment?.stripePaymentIntentId ?? null;

  if (intentId) {
    const voided = await voidCheckoutIntent(
      deps.resolveStripe(),
      intentId,
      stripeOptions,
    );

    if (!voided.ok) {
      if (voided.code === "CONFLICT") {
        return "skipped";
      }

      console.error("[expire-unpaid-orders] INTENT_VOID_FAILED", {
        orderId: order.id,
        code: voided.code,
      });

      return "failed";
    }
  }

  const closed = await deps.db.$transaction((tx) =>
    closePendingOrder(tx, {
      orderId: order.id,
      actorUserId: null,
      eventType: OrderEventType.PAYMENT_EXPIRED,
      now,
    }),
  );

  if (!closed) {
    return "skipped";
  }

  if (closed.removedIntentIds.some((id) => id !== intentId)) {
    await voidIntentsAfterClose(deps.resolveStripe(), {
      orderId: order.id,
      intentIds: closed.removedIntentIds,
      alreadyVoided: intentId,
      timeoutMs: STRIPE_TIMEOUT_MILLISECONDS,
    });
  }

  await Promise.all(
    [order.customerId, order.business.ownerId].map((userId) =>
      sendLocalizedPushToUser(deps.db, userId, {
        message: "orderPaymentExpired",
        url: `home360app://orders/${order.id}`,
      }),
    ),
  );

  return "expired";
}

/**
 * F10 review L2 / M6 reconciliation of CANCELLED orders whose cancel did not
 * finish its tail: units still held (`stockHeldQty > 0`, a crash between
 * the claim and the restore) go back with their RELEASE movement and the
 * missing CANCELLED event; a refund left in REFUNDING (Stripe timeout) is
 * retried with the same idempotency key. Only PRODUCT orders hold stock, so
 * there is no request to reopen.
 */
async function reconcileCancelledOrders(
  deps: ExpireDeps,
  now: Date,
  deadline: number,
): Promise<{ reconciled: number; failed: number; hasMore: boolean }> {
  const settledBefore = new Date(now.getTime() - RECONCILE_GRACE_MILLISECONDS);
  const retryBefore = new Date(now.getTime() - EXPIRY_RETRY_DELAY_MILLISECONDS);
  const rows = await deps.db.order.findMany({
    where: {
      status: OrderStatus.CANCELLED,
      updatedAt: { lte: settledBefore },
      AND: [
        {
          OR: [
            { expiryAttemptedAt: null },
            { expiryAttemptedAt: { lte: retryBefore } },
          ],
        },
        {
          OR: [
            { type: OrderType.PRODUCT, stockHeldQty: { gt: 0 } },
            { payment: { is: { status: PaymentStatus.REFUNDING } } },
          ],
        },
      ],
    },
    orderBy: [
      { expiryAttemptedAt: { sort: "asc", nulls: "first" } },
      { updatedAt: "asc" },
      { id: "asc" },
    ],
    take: RECONCILE_BATCH_SIZE + 1,
    select: {
      id: true,
      stockHeldQty: true,
      payment: { select: { id: true, status: true } },
    },
  });
  let reconciled = 0;
  let failed = 0;

  for (const order of rows.slice(0, RECONCILE_BATCH_SIZE)) {
    if (Date.now() >= deadline) {
      return { reconciled, failed, hasMore: true };
    }

    try {
      await deps.db.order.updateMany({
        where: { id: order.id, status: OrderStatus.CANCELLED },
        data: { expiryAttemptedAt: now },
      });

      if (order.payment?.status === PaymentStatus.REFUNDING) {
        const refund = await refundPayment(
          { db: deps.db, stripe: deps.resolveStripe() },
          { paymentId: order.payment.id },
        );

        if (!refund.ok) {
          failed += 1;
          console.error("[expire-unpaid-orders] REFUND_RETRY_FAILED", {
            orderId: order.id,
            code: refund.code,
          });
        }
      }

      if (order.stockHeldQty > 0) {
        await deps.db.$transaction(async (tx) => {
          const restored = await restoreHeldStock(tx, {
            orderId: order.id,
            reason: "CANCEL_RECONCILED",
          });

          if (restored === 0) {
            return;
          }

          const cancelEvent = await tx.orderEvent.findFirst({
            where: {
              orderId: order.id,
              type: {
                in: [OrderEventType.CANCELLED, OrderEventType.PAYMENT_EXPIRED],
              },
            },
            select: { id: true },
          });

          if (!cancelEvent) {
            await tx.orderEvent.create({
              data: { orderId: order.id, type: OrderEventType.CANCELLED },
            });
          }
        });
      }

      reconciled += 1;
    } catch {
      failed += 1;
      console.error("[expire-unpaid-orders] CANCEL_RECONCILE_FAILED", {
        orderId: order.id,
        code: "UNEXPECTED_ERROR",
      });
    }
  }

  return { reconciled, failed, hasMore: rows.length > RECONCILE_BATCH_SIZE };
}

/**
 * Cron `expire-unpaid-orders` (D10-5, every 15 min): PENDING orders older
 * than `PlatformSettings.unpaidOrderTtlMinutes` are cancelled exactly like
 * the customer's unpaid cancel — Stripe settled first (`expireOrder`), then
 * CANCELLED + PAYMENT_EXPIRED, held stock restored and the request reopened —
 * and both parties get `orderPaymentExpired`. Rows are taken never-attempted
 * first and a recently attempted row is skipped (M3), the run stops picking
 * rows past its time budget (L10) and `hasMore` tells the caller to re-run.
 * Then CANCELLED orders with an unfinished tail are reconciled (L2 / M6) and
 * marketplace requests past `expiresAt` expire. Idempotent: every write is a
 * CAS, so overlapping runs never double-cancel or double-restore.
 */
export async function expireUnpaidOrders(
  deps: ExpireDeps,
  input: { now?: Date } = {},
): Promise<ServiceResult<ExpireUnpaidOrdersResult>> {
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    return svcFail("CONFLICT", "Invalid expiry cutoff");
  }

  const deadline = Date.now() + RUN_BUDGET_MILLISECONDS;
  const ttlMinutes = await resolveUnpaidOrderTtlMinutes(deps.db);
  const cutoff = unpaidOrderCutoff(ttlMinutes, now);
  const retryBefore = new Date(now.getTime() - EXPIRY_RETRY_DELAY_MILLISECONDS);
  const orders = await deps.db.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lte: cutoff },
      OR: [
        { expiryAttemptedAt: null },
        { expiryAttemptedAt: { lte: retryBefore } },
      ],
    },
    orderBy: [
      { expiryAttemptedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    take: EXPIRY_BATCH_SIZE + 1,
    select: {
      id: true,
      customerId: true,
      checkoutSessionId: true,
      business: { select: { ownerId: true } },
      payment: { select: { status: true, stripePaymentIntentId: true } },
    },
  });
  const counts: Record<ExpiryOutcome, number> = {
    expired: 0,
    skipped: 0,
    failed: 0,
  };
  let hasMore = orders.length > EXPIRY_BATCH_SIZE;

  for (const order of orders.slice(0, EXPIRY_BATCH_SIZE)) {
    if (Date.now() >= deadline) {
      hasMore = true;
      break;
    }

    try {
      counts[await expireOrder(deps, order, now)] += 1;
    } catch {
      counts.failed += 1;
      console.error("[expire-unpaid-orders] ORDER_EXPIRY_FAILED", {
        orderId: order.id,
        code: "UNEXPECTED_ERROR",
      });
    }
  }

  let reconciled = 0;

  try {
    const sweep = await reconcileCancelledOrders(deps, now, deadline);

    reconciled = sweep.reconciled;
    counts.failed += sweep.failed;
    hasMore ||= sweep.hasMore;
  } catch {
    console.error("[expire-unpaid-orders] CANCEL_RECONCILE_FAILED", {
      code: "UNEXPECTED_ERROR",
    });
  }

  let requestsExpired = 0;

  try {
    requestsExpired = await expireDueRequests(deps.db, now);
    hasMore ||= requestsExpired >= REQUEST_EXPIRY_BATCH_SIZE;
  } catch {
    console.error("[expire-unpaid-orders] REQUEST_EXPIRY_FAILED", {
      code: "UNEXPECTED_ERROR",
    });
  }

  return svcOk({ ...counts, reconciled, requestsExpired, hasMore });
}
