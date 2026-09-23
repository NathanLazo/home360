import "server-only";

import {
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import Stripe from "stripe";

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
 * Cancels the customer's own order while it is still `PENDING` (never paid).
 * A PaymentSheet attempt is cancelled in Stripe first — an intent that may
 * already carry money makes the whole operation a CONFLICT. Then, in one
 * transaction: order CANCELLED + event, the abandoned attempt's PENDING
 * Payment row removed (it never held money), the order's quote EXPIRED (it
 * stays linked to the cancelled order) and the sibling quotes that the accept
 * expired go back to PENDING so the request reopens as QUOTED/OPEN — unless
 * the request itself already expired.
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
      quote: {
        select: {
          id: true,
          requestId: true,
          request: { select: { expiresAt: true } },
        },
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
    try {
      const intent = await stripe.paymentIntents.retrieve(intentId);

      if (NON_CANCELLABLE_INTENT_STATUSES.includes(intent.status)) {
        return svcFail("CONFLICT", "Order payment is already in progress");
      }

      if (intent.status !== "canceled") {
        await stripe.paymentIntents.cancel(intentId);
      }
    } catch (error) {
      if (isStripeError(error)) {
        return svcFail("STRIPE_ERROR", "Payment intent cancel failed");
      }

      throw error;
    }
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });

    if (claimed.count === 0) {
      return null;
    }

    if (order.payment) {
      await tx.payment.deleteMany({
        where: { id: order.payment.id, status: PaymentStatus.PENDING },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: OrderEventType.CANCELLED,
        actorUserId: input.customerId,
      },
    });

    if (!order.quote) {
      return { requestId: null, requestStatus: null };
    }

    await tx.quote.update({
      where: { id: order.quote.id },
      data: { status: QuoteStatus.EXPIRED },
    });

    const requestExpired =
      order.quote.request.expiresAt !== null &&
      order.quote.request.expiresAt.getTime() <= now.getTime();
    const restored = requestExpired
      ? { count: 0 }
      : await tx.quote.updateMany({
          where: {
            requestId: order.quote.requestId,
            id: { not: order.quote.id },
            status: QuoteStatus.EXPIRED,
          },
          data: { status: QuoteStatus.PENDING },
        });
    const requestStatus = requestExpired
      ? RequestStatus.EXPIRED
      : restored.count > 0
        ? RequestStatus.QUOTED
        : RequestStatus.OPEN;

    await tx.serviceRequest.update({
      where: { id: order.quote.requestId },
      data: { status: requestStatus },
    });

    return { requestId: order.quote.requestId, requestStatus };
  });

  if (!result) {
    return svcFail("CONFLICT", "Only unpaid orders can be cancelled");
  }

  await sendLocalizedPushToUser(db, order.business.ownerId, {
    message: "orderCancelledByCustomer",
    url: `home360app://orders/${order.id}`,
  });

  return svcOk({ orderId: order.id, ...result });
}
