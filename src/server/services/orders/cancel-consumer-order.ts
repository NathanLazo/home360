import "server-only";

import {
  OrderStatus,
  type PrismaClient,
  type RequestStatus,
} from "@generated/prisma";
import type Stripe from "stripe";

import {
  cancelPaidOrderByConsumer,
  type CancelOrderErrorCode,
} from "~/server/services/orders/cancel-order";
import { cancelUnpaidOrder } from "~/server/services/orders/cancel-unpaid-order";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ConsumerCancelResult = {
  orderId: string;
  status: typeof OrderStatus.CANCELLED;
  /** `true` when the order was PAID and the escrow was fully refunded. */
  refunded: boolean;
  requestId: string | null;
  requestStatus: RequestStatus | null;
};

/**
 * Consumer cancel (`tracking.cancelOrder`, corporate `cancelOrder`):
 * an unpaid PENDING order is voided (`cancelUnpaidOrder`); a PAID order
 * whose work has not started is cancelled with a full refund (D10-9,
 * `cancelPaidOrderByConsumer`). Both restore the held stock and reopen the
 * request. Any other state is a CONFLICT; a foreign order a NOT_FOUND.
 */
export async function cancelConsumerOrder(
  deps: { db: PrismaClient; resolveStripe: () => Stripe },
  input: { customerId: string; orderId: string },
): Promise<ServiceResult<ConsumerCancelResult, CancelOrderErrorCode>> {
  const order = await deps.db.order.findFirst({
    where: { id: input.orderId, customerId: input.customerId },
    select: { id: true, status: true },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.status === OrderStatus.PAID) {
    return cancelPaidOrderByConsumer(deps, input);
  }

  const cancelled = await cancelUnpaidOrder(
    { db: deps.db, stripe: deps.resolveStripe() },
    input,
  );

  if (!cancelled.ok) {
    return cancelled;
  }

  return svcOk({
    ...cancelled.data,
    status: OrderStatus.CANCELLED,
    refunded: false,
  });
}
