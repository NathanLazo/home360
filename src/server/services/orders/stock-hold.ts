import "server-only";

import type { Prisma } from "@generated/prisma";

type StockDb = Pick<Prisma.TransactionClient, "productStock" | "order">;

/**
 * D10-4 reservation: atomically takes `quantity` units from the branch's
 * available stock. The conditional `updateMany` (stock >= quantity) is the
 * guard, so stock can never go negative and concurrent buyers of the last
 * unit cannot both win. Returns false when the branch lacks the units.
 */
export async function reserveProductStock(
  tx: StockDb,
  input: { productId: string; branchId: string; quantity: number },
): Promise<boolean> {
  const reserved = await tx.productStock.updateMany({
    where: {
      productId: input.productId,
      branchId: input.branchId,
      stock: { gte: input.quantity },
    },
    data: { stock: { decrement: input.quantity } },
  });

  return reserved.count === 1;
}

/**
 * D10-4 restore: returns the units an order holds exactly once. The CAS on
 * `stockHeldQty` (> 0 → 0) is the single restore point shared by the unpaid
 * cancel, the refunded cancel, a FULL_REFUND dispute and the expiry cron; a
 * second caller finds nothing to restore. The upsert survives a ProductStock
 * row removed while the order was open. Returns the restored units.
 */
export async function restoreHeldStock(
  tx: StockDb,
  input: { orderId: string },
): Promise<number> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { productId: true, branchId: true, stockHeldQty: true },
  });

  if (!order || order.stockHeldQty <= 0) {
    return 0;
  }

  const released = await tx.order.updateMany({
    where: { id: input.orderId, stockHeldQty: order.stockHeldQty },
    data: { stockHeldQty: 0 },
  });

  if (released.count === 0) {
    return 0;
  }

  // A deleted product or branch (SetNull) has nowhere to return the units.
  if (order.productId === null || order.branchId === null) {
    return 0;
  }

  await tx.productStock.upsert({
    where: {
      productId_branchId: {
        productId: order.productId,
        branchId: order.branchId,
      },
    },
    create: {
      productId: order.productId,
      branchId: order.branchId,
      stock: order.stockHeldQty,
    },
    update: { stock: { increment: order.stockHeldQty } },
  });

  return order.stockHeldQty;
}
