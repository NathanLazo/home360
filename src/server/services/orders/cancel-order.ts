import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import Stripe from "stripe";

import {
  reopenRequestAfterCancel,
  type ReopenedRequest,
} from "~/server/services/orders/reopen-request";
import { restoreHeldStock } from "~/server/services/orders/stock-hold";
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
 * Shared refund path of a PAID order (business cancel and, D10-9, the
 * customer's cancel before work starts). The order is claimed PAID →
 * CANCELLED by CAS (inside the caller's row scope) before touching Stripe so
 * `acceptProduct` / the worker flow cannot race it, and restored to `PAID`
 * if the full refund fails. Once the money is back, one short transaction
 * restores the held stock exactly once (D10-4) and reopens the request and
 * its sibling quotes (D10-9).
 */
export async function cancelPaidOrderWithRefund(
  deps: CancelOrderDeps,
  input: {
    orderId: string;
    paymentId: string;
    scope: Prisma.OrderWhereInput;
  },
): Promise<ServiceResult<ReopenedRequest, CancelOrderErrorCode>> {
  const { db } = deps;
  const claimed = await db.order.updateMany({
    where: { ...input.scope, id: input.orderId, status: OrderStatus.PAID },
    data: { status: OrderStatus.CANCELLED },
  });

  if (claimed.count === 0) {
    return svcFail("CONFLICT", "Order can no longer be cancelled");
  }

  const restorePaid = () =>
    db.order.updateMany({
      where: { id: input.orderId, status: OrderStatus.CANCELLED },
      data: { status: OrderStatus.PAID },
    });

  try {
    // Omitting both components is F3's contract for a total refund.
    const refund = await refundPayment(
      { db, stripe: deps.resolveStripe() },
      { paymentId: input.paymentId },
    );

    if (!refund.ok) {
      await restorePaid();
      return svcFail(refund.code);
    }
  } catch (error) {
    await restorePaid();
    throw error;
  }

  const reopened = await db.$transaction(async (tx) => {
    await restoreHeldStock(tx, { orderId: input.orderId });

    return reopenRequestAfterCancel(tx, { orderId: input.orderId });
  });

  return svcOk(reopened);
}

/**
 * Business cancels an order that has not started (web dashboard):
 *
 * - `PENDING` (unpaid) → `CANCELLED`. A checkout PaymentIntent still open is
 *   voided first so a late capture cannot land on a cancelled order.
 * - `PAID` (escrow held, product not yet accepted / service not yet started)
 *   → `CANCELLED` plus a FULL refund (`cancelPaidOrderWithRefund`).
 *
 * Both paths restore the held stock and reopen the request and its sibling
 * quotes exactly like the customer's cancel (D10-4 / D10-9). Anything else
 * (in progress, shipping, completed, disputed, released) is a CONFLICT:
 * PENDIENTES.md forbids refunds after release and in-flight work is resolved
 * through disputes. Writes a `CANCELLED` OrderEvent carrying the reason and
 * pushes the customer.
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

    const claimed = await db.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          businessId: input.businessId,
          status: OrderStatus.PENDING,
        },
        data: { status: OrderStatus.CANCELLED },
      });

      if (changed.count === 0) {
        return false;
      }

      await restoreHeldStock(tx, { orderId: order.id });
      await reopenRequestAfterCancel(tx, { orderId: order.id });

      return true;
    });

    if (!claimed) {
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

    const cancelled = await cancelPaidOrderWithRefund(deps, {
      orderId: order.id,
      paymentId: payment.id,
      scope: { businessId: input.businessId },
    });

    if (!cancelled.ok) {
      return cancelled;
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

/**
 * D10-9: the consumer may cancel a PAID order before the work starts —
 * SERVICE without EN_ROUTE, PRODUCT without the business's ACCEPTED — with a
 * full refund and the stock restored. Both preconditions are implied by
 * `status = PAID` (EN_ROUTE moves the order to IN_PROGRESS, acceptProduct to
 * SHIPPING, a dispute to DISPUTED) and the CAS claim on PAID enforces them
 * against concurrent transitions.
 */
export function canConsumerCancelPaidOrder(order: {
  type: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  hasDispute: boolean;
  events: readonly { type: OrderEventType }[];
}): boolean {
  if (
    order.status !== OrderStatus.PAID ||
    order.hasDispute ||
    (order.paymentStatus !== PaymentStatus.IN_ESCROW &&
      order.paymentStatus !== PaymentStatus.REFUNDING)
  ) {
    return false;
  }

  const blockingEvent =
    order.type === OrderType.SERVICE
      ? OrderEventType.EN_ROUTE
      : OrderEventType.ACCEPTED;

  return !order.events.some((event) => event.type === blockingEvent);
}

export type CancelPaidByConsumerResult = CancelOrderResult & ReopenedRequest;

/** Consumer-side PAID cancel (tracking.cancelOrder / corporate cancelOrder). */
export async function cancelPaidOrderByConsumer(
  deps: CancelOrderDeps,
  input: { customerId: string; orderId: string },
): Promise<ServiceResult<CancelPaidByConsumerResult, CancelOrderErrorCode>> {
  const { db } = deps;
  const order = await db.order.findFirst({
    where: { id: input.orderId, customerId: input.customerId },
    select: {
      id: true,
      type: true,
      status: true,
      business: { select: { ownerId: true } },
      payment: { select: { id: true, status: true } },
      dispute: { select: { id: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { type: true },
      },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (
    !order.payment ||
    !canConsumerCancelPaidOrder({
      type: order.type,
      status: order.status,
      paymentStatus: order.payment.status,
      hasDispute: order.dispute !== null,
      events: order.events,
    })
  ) {
    return svcFail("CONFLICT", "Order can no longer be cancelled");
  }

  const cancelled = await cancelPaidOrderWithRefund(deps, {
    orderId: order.id,
    paymentId: order.payment.id,
    scope: { customerId: input.customerId },
  });

  if (!cancelled.ok) {
    return cancelled;
  }

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: OrderEventType.CANCELLED,
      actorUserId: input.customerId,
    },
  });

  await sendLocalizedPushToUser(db, order.business.ownerId, {
    message: "paidOrderCancelledByCustomer",
    url: `home360app://orders/${order.id}`,
  });

  return svcOk({
    orderId: order.id,
    status: OrderStatus.CANCELLED,
    refunded: true,
    ...cancelled.data,
  });
}
