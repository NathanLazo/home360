import "server-only";

import type { OrderStatus, PrismaClient } from "@generated/prisma";

export const ACTIVE_ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "IN_PROGRESS",
  "SHIPPING",
  "DISPUTED",
] as const satisfies readonly OrderStatus[];

export function countActiveOrders(
  db: PrismaClient,
  businessId: string,
): Promise<number> {
  return db.order.count({
    where: {
      businessId,
      status: { in: [...ACTIVE_ORDER_STATUSES] },
    },
  });
}
