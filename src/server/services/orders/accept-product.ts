import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  type PrismaClient,
} from "@generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type AcceptProductResult = {
  orderId: string;
  status: typeof OrderStatus.SHIPPING;
};

/**
 * Business accepts a paid PRODUCT order (M5-W1 / N1): PAID → SHIPPING plus
 * OrderEvent ACCEPTED. Foreign or non-PRODUCT / non-PAID orders answer a
 * generic NOT_FOUND or CONFLICT so the response never leaks tenancy.
 */
export async function acceptProductOrder(
  db: PrismaClient,
  input: { businessId: string; actorUserId: string; orderId: string },
): Promise<ServiceResult<AcceptProductResult>> {
  const order = await db.order.findFirst({
    where: {
      id: input.orderId,
      businessId: input.businessId,
      type: OrderType.PRODUCT,
    },
    select: { id: true, status: true },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.status !== OrderStatus.PAID) {
    return svcFail("CONFLICT", "Order is not awaiting acceptance");
  }

  const claimed = await db.order.updateMany({
    where: {
      id: order.id,
      businessId: input.businessId,
      type: OrderType.PRODUCT,
      status: OrderStatus.PAID,
    },
    data: { status: OrderStatus.SHIPPING },
  });

  if (claimed.count === 0) {
    return svcFail("CONFLICT", "Order is not awaiting acceptance");
  }

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: OrderEventType.ACCEPTED,
      actorUserId: input.actorUserId,
    },
  });

  return svcOk({ orderId: order.id, status: OrderStatus.SHIPPING });
}
