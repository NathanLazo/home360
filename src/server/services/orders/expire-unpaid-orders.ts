import "server-only";

import {
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import type Stripe from "stripe";

import {
  closePendingOrder,
  voidCheckoutIntent,
} from "~/server/services/orders/cancel-unpaid-order";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const EXPIRY_BATCH_SIZE = 100;
const REQUEST_EXPIRY_BATCH_SIZE = 500;
const MILLISECONDS_PER_MINUTE = 60_000;
const DEFAULT_UNPAID_ORDER_TTL_MINUTES = 30;

export type ExpireUnpaidOrdersResult = {
  /** PENDING orders cancelled with PAYMENT_EXPIRED. */
  expired: number;
  /** Orders left alone because their PaymentIntent may carry money. */
  skipped: number;
  failed: number;
  /** OPEN/QUOTED requests past `expiresAt` moved to EXPIRED. */
  requestsExpired: number;
  hasMore: boolean;
};

type ExpireDeps = {
  db: PrismaClient;
  /** Lazily resolved: orders without a PaymentIntent never need Stripe. */
  resolveStripe: () => Stripe;
};

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
 * Cron `expire-unpaid-orders` (D10-5, every 15 min): PENDING orders older
 * than `PlatformSettings.unpaidOrderTtlMinutes` are cancelled exactly like
 * the customer's unpaid cancel — PaymentIntent voided first (one that may
 * carry money is skipped: the webhook will capture it), then CANCELLED +
 * PAYMENT_EXPIRED, held stock restored and the request reopened — and both
 * parties get `orderPaymentExpired`. Idempotent: every write is a CAS on
 * PENDING. Also expires marketplace requests past `expiresAt`.
 */
export async function expireUnpaidOrders(
  deps: ExpireDeps,
  input: { now?: Date } = {},
): Promise<ServiceResult<ExpireUnpaidOrdersResult>> {
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    return svcFail("CONFLICT", "Invalid expiry cutoff");
  }

  const settings = await deps.db.platformSettings.findUnique({
    where: { id: 1 },
    select: { unpaidOrderTtlMinutes: true },
  });
  const ttlMinutes =
    settings &&
    Number.isInteger(settings.unpaidOrderTtlMinutes) &&
    settings.unpaidOrderTtlMinutes > 0
      ? settings.unpaidOrderTtlMinutes
      : DEFAULT_UNPAID_ORDER_TTL_MINUTES;
  const cutoff = new Date(now.getTime() - ttlMinutes * MILLISECONDS_PER_MINUTE);
  const orders = await deps.db.order.findMany({
    where: { status: OrderStatus.PENDING, createdAt: { lte: cutoff } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: EXPIRY_BATCH_SIZE + 1,
    select: {
      id: true,
      customerId: true,
      business: { select: { ownerId: true } },
      payment: {
        select: { id: true, status: true, stripePaymentIntentId: true },
      },
    },
  });
  const batch = orders.slice(0, EXPIRY_BATCH_SIZE);
  let expired = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of batch) {
    try {
      if (order.payment && order.payment.status !== PaymentStatus.PENDING) {
        skipped += 1;
        continue;
      }

      const intentId = order.payment?.stripePaymentIntentId ?? null;

      if (intentId) {
        const voided = await voidCheckoutIntent(deps.resolveStripe(), intentId);

        if (!voided.ok) {
          if (voided.code === "CONFLICT") {
            skipped += 1;
          } else {
            failed += 1;
            console.error("[expire-unpaid-orders] INTENT_VOID_FAILED", {
              orderId: order.id,
              code: voided.code,
            });
          }

          continue;
        }
      }

      const closed = await deps.db.$transaction((tx) =>
        closePendingOrder(tx, {
          orderId: order.id,
          paymentId: order.payment?.id ?? null,
          actorUserId: null,
          eventType: OrderEventType.PAYMENT_EXPIRED,
          now,
        }),
      );

      if (!closed) {
        skipped += 1;
        continue;
      }

      expired += 1;

      await Promise.all(
        [order.customerId, order.business.ownerId].map((userId) =>
          sendLocalizedPushToUser(deps.db, userId, {
            message: "orderPaymentExpired",
            url: `home360app://orders/${order.id}`,
          }),
        ),
      );
    } catch {
      failed += 1;
      console.error("[expire-unpaid-orders] ORDER_EXPIRY_FAILED", {
        orderId: order.id,
        code: "UNEXPECTED_ERROR",
      });
    }
  }

  let requestsExpired = 0;

  try {
    requestsExpired = await expireDueRequests(deps.db, now);
  } catch {
    console.error("[expire-unpaid-orders] REQUEST_EXPIRY_FAILED", {
      code: "UNEXPECTED_ERROR",
    });
  }

  return svcOk({
    expired,
    skipped,
    failed,
    requestsExpired,
    hasMore: orders.length > EXPIRY_BATCH_SIZE,
  });
}
