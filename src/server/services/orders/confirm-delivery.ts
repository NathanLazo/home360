import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import type Stripe from "stripe";

import {
  releasePayment,
  type ReleasePaymentErrorCode,
} from "~/server/services/payments/escrow";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { isPaymentReleaseNotificationEnabled } from "~/server/services/settings/platform-policies";
import { isAwaitingConfirmation } from "~/server/services/orders/work-cycle";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/**
 * Order states a customer may confirm as delivered. `PENDING` is excluded
 * because the escrow does not exist yet, and terminal or disputed states are
 * never re-completed.
 */
const DELIVERABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SHIPPING,
];

export type ConfirmDeliveryErrorCode =
  "ORDER_NOT_FOUND" | ReleasePaymentErrorCode;

export type ConfirmDeliveryScope =
  | { kind: "CUSTOMER"; customerId: string }
  | { kind: "CORPORATE"; corporateAccountId: string };

/**
 * Customer (or corporate) confirmation that releases the escrow. SERVICE
 * orders may only be confirmed once the technician finished the current work
 * cycle (WORK_DONE / CONFIRMATION_REQUESTED, a pending rework reopens it);
 * PRODUCT orders keep the delivery-status rule. The actor is always the
 * order's customer user so the CONFIRMED event is attributed correctly.
 */
export async function confirmOrderDelivery(
  deps: { db: PrismaClient; stripe: Stripe },
  input: { scope: ConfirmDeliveryScope; orderId: string },
): Promise<
  ServiceResult<
    { orderId: string; paymentId: string },
    ConfirmDeliveryErrorCode
  >
> {
  const { db } = deps;
  const where: Prisma.OrderWhereInput =
    input.scope.kind === "CUSTOMER"
      ? { id: input.orderId, customerId: input.scope.customerId }
      : {
          id: input.orderId,
          corporateAccountId: input.scope.corporateAccountId,
        };
  const order = await db.order.findFirst({
    where,
    select: {
      id: true,
      type: true,
      status: true,
      customerId: true,
      payment: { select: { id: true, status: true } },
      business: { select: { ownerId: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { type: true },
      },
    },
  });

  if (!order) {
    return svcFail("ORDER_NOT_FOUND", "Order not found");
  }

  if (!order.payment) {
    return svcFail("PAYMENT_NOT_RELEASABLE", "Order has no escrowed payment");
  }

  if (!DELIVERABLE_ORDER_STATUSES.includes(order.status)) {
    return svcFail("CONFLICT", "Order cannot be confirmed in its status");
  }

  if (
    order.type === OrderType.SERVICE &&
    !isAwaitingConfirmation(order.events)
  ) {
    return svcFail("CONFLICT", "The work has not been marked as done yet");
  }

  const released = await releasePayment(deps, {
    paymentId: order.payment.id,
    event: { type: OrderEventType.CONFIRMED, actorUserId: order.customerId },
  });

  if (!released.ok) {
    return released;
  }

  await db.order.updateMany({
    where: { id: order.id, status: { in: DELIVERABLE_ORDER_STATUSES } },
    data: { status: OrderStatus.COMPLETED },
  });

  // W13 "Avisar liberación de pago" gates the release push.
  if (await isPaymentReleaseNotificationEnabled(db)) {
    await sendLocalizedPushToUser(db, order.business.ownerId, {
      message: "deliveryConfirmed",
      url: `home360app://orders/${order.id}`,
    });
  }

  return svcOk({ orderId: order.id, paymentId: released.data.paymentId });
}
