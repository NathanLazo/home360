import "server-only";

import {
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  type PrismaClient,
} from "@generated/prisma";
import Stripe from "stripe";

import {
  refundPayment,
  type RefundPaymentErrorCode,
} from "~/server/services/payments/escrow";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type CancelOrderResult = {
  orderId: string;
  status: typeof OrderStatus.CANCELLED;
  refunded: boolean;
};

export type CancelOrderErrorCode = RefundPaymentErrorCode;

type CancelOrderDeps = {
  db: PrismaClient;
  /** Lazily resolved: an unpaid cancel without a PaymentIntent never needs Stripe. */
  resolveStripe: () => Stripe;
};

/** PaymentIntent states in which money may still move; cancelling is unsafe. */
const IN_FLIGHT_INTENT_STATUSES: ReadonlySet<Stripe.PaymentIntent.Status> =
  new Set(["processing", "succeeded", "requires_capture"]);

async function voidPendingIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<ServiceResult<null>> {
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status === "canceled") {
      return svcOk(null);
    }

    if (IN_FLIGHT_INTENT_STATUSES.has(intent.status)) {
      return svcFail("CONFLICT", "Payment is already in flight");
    }

    await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: "abandoned",
    });

    return svcOk(null);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }
}

/**
 * Business cancels an order that has not started (web dashboard):
 *
 * - `PENDING` (unpaid) → `CANCELLED`. A checkout PaymentIntent still open is
 *   voided first so a late capture cannot land on a cancelled order.
 * - `PAID` (escrow held, product not yet accepted / service not yet started)
 *   → `CANCELLED` plus a FULL refund through the F3 refund service. The order
 *   is claimed by CAS before touching Stripe and restored to `PAID` if the
 *   refund fails, so `acceptProduct` / the worker flow cannot race it.
 *
 * Anything else (in progress, shipping, completed, disputed, released) is a
 * CONFLICT: PENDIENTES.md forbids refunds after release and in-flight work is
 * resolved through disputes. Writes a `CANCELLED` OrderEvent carrying the
 * reason and pushes the customer.
 */
export async function cancelOrder(
  deps: CancelOrderDeps,
  input: {
    businessId: string;
    actorUserId: string;
    orderId: string;
    reason: string;
  },
): Promise<ServiceResult<CancelOrderResult, CancelOrderErrorCode>> {
  const { db } = deps;
  const order = await db.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId },
    select: {
      id: true,
      status: true,
      customerId: true,
      payment: {
        select: { id: true, status: true, stripePaymentIntentId: true },
      },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  let refunded = false;

  if (order.status === OrderStatus.PENDING) {
    const payment = order.payment;

    if (payment && payment.status !== PaymentStatus.PENDING) {
      return svcFail("CONFLICT", "Order payment is not pending");
    }

    if (payment?.stripePaymentIntentId) {
      const voided = await voidPendingIntent(
        deps.resolveStripe(),
        payment.stripePaymentIntentId,
      );

      if (!voided.ok) {
        return voided;
      }
    }

    const claimed = await db.order.updateMany({
      where: {
        id: order.id,
        businessId: input.businessId,
        status: OrderStatus.PENDING,
      },
      data: { status: OrderStatus.CANCELLED },
    });

    if (claimed.count === 0) {
      return svcFail("CONFLICT", "Order can no longer be cancelled");
    }
  } else if (order.status === OrderStatus.PAID) {
    const payment = order.payment;

    // REFUNDING is a previous full-refund attempt whose Stripe call failed:
    // refundPayment resumes it with the same deterministic idempotency key.
    if (
      !payment ||
      (payment.status !== PaymentStatus.IN_ESCROW &&
        payment.status !== PaymentStatus.REFUNDING)
    ) {
      return svcFail("PAYMENT_NOT_REFUNDABLE");
    }

    const claimed = await db.order.updateMany({
      where: {
        id: order.id,
        businessId: input.businessId,
        status: OrderStatus.PAID,
      },
      data: { status: OrderStatus.CANCELLED },
    });

    if (claimed.count === 0) {
      return svcFail("CONFLICT", "Order can no longer be cancelled");
    }

    const restorePaid = () =>
      db.order.updateMany({
        where: { id: order.id, status: OrderStatus.CANCELLED },
        data: { status: OrderStatus.PAID },
      });

    try {
      // Omitting both components is F3's contract for a total refund.
      const refund = await refundPayment(
        { db, stripe: deps.resolveStripe() },
        { paymentId: payment.id },
      );

      if (!refund.ok) {
        await restorePaid();
        return svcFail(refund.code);
      }
    } catch (error) {
      await restorePaid();
      throw error;
    }

    refunded = true;
  } else {
    return svcFail("CONFLICT", "Order can no longer be cancelled");
  }

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: OrderEventType.CANCELLED,
      actorUserId: input.actorUserId,
      note: input.reason,
    },
  });

  await sendLocalizedPushToUser(db, order.customerId, {
    message: "orderCancelled",
    url: `home360app://orders/${order.id}`,
  });

  return svcOk({ orderId: order.id, status: OrderStatus.CANCELLED, refunded });
}
