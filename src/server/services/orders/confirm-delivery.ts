import "server-only";

import {
  OrderEventType,
  OrderStatus,
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
 * Customer (or corporate) confirmation that releases the escrow. Every order
 * may only be confirmed once the provider requested it (CONFIRMATION_REQUESTED
 * written by WORK_DONE or, for PRODUCT, DELIVERED; a pending rework reopens
 * the cycle). The actor is always the
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

  // D10-8: both types confirm only after the provider asked for it
  // (SERVICE: WORK_DONE; PRODUCT: DELIVERED). A pending rework reopens it.
  if (!isAwaitingConfirmation(order.events)) {
    return svcFail("CONFLICT", "The order has not been delivered yet");
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
