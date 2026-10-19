import "server-only";

import {
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  type Prisma,
  type PrismaClient,
  type RequestStatus,
} from "@generated/prisma";
import Stripe from "stripe";

import {
  reopenRequestAfterCancel,
  type ReopenedRequest,
} from "~/server/services/orders/reopen-request";
import { restoreHeldStock } from "~/server/services/orders/stock-hold";
import { expireOrderCheckoutSession } from "~/server/services/payments/order-checkout-session";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type CancelUnpaidOrderDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type CancelUnpaidOrderResult = {
  orderId: string;
  requestId: string | null;
  requestStatus: RequestStatus | null;
};

/** PaymentIntent states where money may already be on its way. */
const NON_CANCELLABLE_INTENT_STATUSES: Stripe.PaymentIntent.Status[] = [
  "succeeded",
  "processing",
  "requires_capture",
];

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Cancels a checkout PaymentIntent that never carried money. An intent that
 * may already hold money (succeeded / processing / requires_capture) makes
 * the caller's cancellation a CONFLICT: the webhook will capture it.
 * `timeoutMs` bounds each Stripe call (the expiry cron, F10 review L10).
 */
export async function voidCheckoutIntent(
  stripe: Stripe,
  intentId: string,
  options: { timeoutMs?: number } = {},
): Promise<ServiceResult<null>> {
  const requestOptions =
    options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {};

  try {
    const intent = await stripe.paymentIntents.retrieve(
      intentId,
      {},
      requestOptions,
    );

    if (NON_CANCELLABLE_INTENT_STATUSES.includes(intent.status)) {
      return svcFail("CONFLICT", "Order payment is already in progress");
    }

    if (intent.status !== "canceled") {
      await stripe.paymentIntents.cancel(intentId, {}, requestOptions);
    }

    return svcOk(null);
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Payment intent cancel failed");
    }

    throw error;
  }
}

/**
 * F10 review M2: voids, after the closing transaction, the PaymentIntents of
 * the PENDING Payment rows `closePendingOrder` removed that the caller did
 * not void beforehand (a `createIntent` that raced the close). Best effort:
 * an intent that already carries money is captured onto the CANCELLED order
 * by the webhook, which refunds it (`capturePayment` → ORDER_NOT_PAYABLE).
 */
export async function voidIntentsAfterClose(
  stripe: Stripe,
  input: {
    orderId: string;
    intentIds: readonly string[];
    alreadyVoided?: string | null;
    timeoutMs?: number;
  },
): Promise<void> {
  for (const intentId of input.intentIds) {
    if (intentId === input.alreadyVoided) {
      continue;
    }

    try {
      const voided = await voidCheckoutIntent(stripe, intentId, {
        ...(input.timeoutMs !== undefined
          ? { timeoutMs: input.timeoutMs }
          : {}),
      });

      if (!voided.ok) {
        console.error("[close-pending-order] LATE_INTENT_VOID_FAILED", {
          orderId: input.orderId,
          code: voided.code,
        });
      }
    } catch {
      console.error("[close-pending-order] LATE_INTENT_VOID_FAILED", {
        orderId: input.orderId,
        code: "UNEXPECTED_ERROR",
      });
    }
  }
}

export type ClosedPendingOrder = ReopenedRequest & {
  /** PaymentIntents of the PENDING Payment rows removed by the close. */
  removedIntentIds: string[];
};

/**
 * Closes a never-paid order inside the caller's transaction: CAS
 * PENDING → CANCELLED, every PENDING Payment row of the order removed by
 * `orderId` (they never held money; F10 review M2 — not a pre-read id, so a
 * concurrent `createIntent` cannot leave one behind), the lifecycle event
 * (CANCELLED by the customer / business or PAYMENT_EXPIRED by the cron), the
 * held stock restored (D10-4) and the request reopened (D10-9). Returns the
 * removed intent ids so the caller voids them after the tx
 * (`voidIntentsAfterClose`); `null` when the order is no longer PENDING.
 */
export async function closePendingOrder(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    actorUserId: string | null;
    eventType:
      typeof OrderEventType.CANCELLED | typeof OrderEventType.PAYMENT_EXPIRED;
    note?: string;
    /** Ledger reason of the RELEASE movement (defaults to the event type). */
    stockReason?: string;
    now: Date;
  },
): Promise<ClosedPendingOrder | null> {
  const claimed = await tx.order.updateMany({
    where: { id: input.orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.CANCELLED },
  });

  if (claimed.count === 0) {
    return null;
  }

  const pendingPayments = await tx.payment.findMany({
    where: { orderId: input.orderId, status: PaymentStatus.PENDING },
    select: { stripePaymentIntentId: true },
  });

  await tx.payment.deleteMany({
    where: { orderId: input.orderId, status: PaymentStatus.PENDING },
  });

  await tx.orderEvent.create({
    data: {
      orderId: input.orderId,
      type: input.eventType,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.note ? { note: input.note } : {}),
    },
  });

  await restoreHeldStock(tx, {
    orderId: input.orderId,
    actorUserId: input.actorUserId,
    reason: input.stockReason ?? input.eventType,
  });

  const reopened = await reopenRequestAfterCancel(tx, {
    orderId: input.orderId,
    now: input.now,
  });

  return {
    ...reopened,
    removedIntentIds: pendingPayments.flatMap(({ stripePaymentIntentId }) =>
      stripePaymentIntentId ? [stripePaymentIntentId] : [],
    ),
  };
}

/**
 * Cancels the customer's own order while it is still `PENDING` (never paid).
 * A PaymentSheet attempt is cancelled in Stripe first — an intent that may
 * already carry money makes the whole operation a CONFLICT. Then, in one
 * transaction, `closePendingOrder`: order CANCELLED + event, PENDING Payment
 * row removed, held stock restored and the request reopened (QUOTED/OPEN)
 * unless it already expired.
 */
export async function cancelUnpaidOrder(
  deps: CancelUnpaidOrderDeps,
  input: { customerId: string; orderId: string },
): Promise<ServiceResult<CancelUnpaidOrderResult>> {
  const { db, stripe } = deps;
  const order = await db.order.findFirst({
    where: { id: input.orderId, customerId: input.customerId },
    select: {
      id: true,
      status: true,
      checkoutSessionId: true,
      business: { select: { ownerId: true } },
      payment: {
        select: { id: true, status: true, stripePaymentIntentId: true },
      },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.status !== OrderStatus.PENDING) {
    return svcFail("CONFLICT", "Only unpaid orders can be cancelled");
  }

  if (order.payment && order.payment.status !== PaymentStatus.PENDING) {
    return svcFail("CONFLICT", "Order payment is already in progress");
  }

  // F10 review H1: a hosted Checkout Session must stop being payable first.
  if (order.checkoutSessionId) {
    const sessionClosed = await expireOrderCheckoutSession(
      stripe,
      order.checkoutSessionId,
    );

    if (!sessionClosed.ok) {
      return sessionClosed;
    }
  }

  const intentId = order.payment?.stripePaymentIntentId ?? null;

  if (intentId) {
    const voided = await voidCheckoutIntent(stripe, intentId);

    if (!voided.ok) {
      return voided;
    }
  }

  const now = new Date();
  const closed = await db.$transaction((tx) =>
    closePendingOrder(tx, {
      orderId: order.id,
      actorUserId: input.customerId,
      eventType: OrderEventType.CANCELLED,
      now,
    }),
  );

  if (!closed) {
    return svcFail("CONFLICT", "Only unpaid orders can be cancelled");
  }

  const { removedIntentIds, ...result } = closed;

  await voidIntentsAfterClose(stripe, {
    orderId: order.id,
    intentIds: removedIntentIds,
    alreadyVoided: intentId,
  });

  await sendLocalizedPushToUser(db, order.business.ownerId, {
    message: "orderCancelledByCustomer",
    url: `home360app://orders/${order.id}`,
  });

  return svcOk({ orderId: order.id, ...result });
}
