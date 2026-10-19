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
 */
export async function voidCheckoutIntent(
  stripe: Stripe,
  intentId: string,
): Promise<ServiceResult<null>> {
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId);

    if (NON_CANCELLABLE_INTENT_STATUSES.includes(intent.status)) {
      return svcFail("CONFLICT", "Order payment is already in progress");
    }

    if (intent.status !== "canceled") {
      await stripe.paymentIntents.cancel(intentId);
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
 * Closes a never-paid order inside the caller's transaction: CAS
 * PENDING → CANCELLED, the abandoned attempt's PENDING Payment row removed
 * (it never held money), the lifecycle event (CANCELLED by the customer or
 * PAYMENT_EXPIRED by the cron), the held stock restored (D10-4) and the
 * request reopened (D10-9). `null` when the order is no longer PENDING.
 */
export async function closePendingOrder(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    paymentId: string | null;
    actorUserId: string | null;
    eventType:
      typeof OrderEventType.CANCELLED | typeof OrderEventType.PAYMENT_EXPIRED;
    now: Date;
  },
): Promise<ReopenedRequest | null> {
  const claimed = await tx.order.updateMany({
    where: { id: input.orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.CANCELLED },
  });

  if (claimed.count === 0) {
    return null;
  }

  if (input.paymentId) {
    await tx.payment.deleteMany({
      where: { id: input.paymentId, status: PaymentStatus.PENDING },
    });
  }

  await tx.orderEvent.create({
    data: {
      orderId: input.orderId,
      type: input.eventType,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    },
  });

  await restoreHeldStock(tx, { orderId: input.orderId });

  return reopenRequestAfterCancel(tx, {
    orderId: input.orderId,
    now: input.now,
  });
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

  const intentId = order.payment?.stripePaymentIntentId ?? null;

  if (intentId) {
    const voided = await voidCheckoutIntent(stripe, intentId);

    if (!voided.ok) {
      return voided;
    }
  }

  const now = new Date();
  const result = await db.$transaction((tx) =>
    closePendingOrder(tx, {
      orderId: order.id,
      paymentId: order.payment?.id ?? null,
      actorUserId: input.customerId,
      eventType: OrderEventType.CANCELLED,
      now,
    }),
  );

  if (!result) {
    return svcFail("CONFLICT", "Only unpaid orders can be cancelled");
  }

  await sendLocalizedPushToUser(db, order.business.ownerId, {
    message: "orderCancelledByCustomer",
    url: `home360app://orders/${order.id}`,
  });

  return svcOk({ orderId: order.id, ...result });
}
