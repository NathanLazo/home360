import "server-only";

import { StockMovementType, type Prisma } from "@generated/prisma";

type StockDb = Pick<
  Prisma.TransactionClient,
  "productStock" | "order" | "stockMovement"
>;

export type StockMovementInput = {
  productId: string;
  branchId: string;
  type: StockMovementType;
  /** Signed change applied to `ProductStock.stock`. */
  quantity: number;
  /** `ProductStock.stock` right after the change (read in the same tx). */
  stockAfter: number;
  orderId?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
};

/**
 * F10-b ledger: one row per ProductStock change, always inside the
 * transaction that changed the stock so the ledger and the counter can never
 * disagree. Every writer of `ProductStock.stock` goes through here.
 */
export async function recordStockMovement(
  tx: Pick<Prisma.TransactionClient, "stockMovement">,
  input: StockMovementInput,
): Promise<void> {
  await tx.stockMovement.create({
    data: {
      productId: input.productId,
      branchId: input.branchId,
      type: input.type,
      quantity: input.quantity,
      stockAfter: input.stockAfter,
      orderId: input.orderId ?? null,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? null,
    },
  });
}

export type StockAdjustment = {
  productId: string;
  branchId: string;
  /** `ProductStock.stock` before the write (0 for a new row). */
  before: number;
  /** `ProductStock.stock` after the write (0 for a removed row). */
  after: number;
};

/**
 * F10-b ADJUST rows for business edits (form, row action, CSV import, new
 * product, branch removed from a product): one signed delta per changed
 * row, written in the transaction that changed the stock. No-op deltas are
 * skipped.
 */
export async function recordStockAdjustments(
  tx: Pick<Prisma.TransactionClient, "stockMovement">,
  adjustments: readonly StockAdjustment[],
  meta: { actorUserId?: string | null; reason: string },
): Promise<void> {
  const rows = adjustments.filter(({ before, after }) => before !== after);

  if (rows.length === 0) {
    return;
  }

  await tx.stockMovement.createMany({
    data: rows.map((row) => ({
      productId: row.productId,
      branchId: row.branchId,
      type: StockMovementType.ADJUST,
      quantity: row.after - row.before,
      stockAfter: row.after,
      actorUserId: meta.actorUserId ?? null,
      reason: meta.reason,
    })),
  });
}

/**
 * D10-4 reservation: atomically takes `quantity` units from the branch's
 * available stock. The conditional `updateMany` (stock >= quantity) is the
 * guard, so stock can never go negative and concurrent buyers of the last
 * unit cannot both win. Returns the stock left after the reservation, or
 * `null` when the branch lacks the units. The caller records the RESERVE
 * movement once the order exists (`recordStockMovement`), in the same tx.
 */
export async function reserveProductStock(
  tx: StockDb,
  input: { productId: string; branchId: string; quantity: number },
): Promise<number | null> {
  const reserved = await tx.productStock.updateMany({
    where: {
      productId: input.productId,
      branchId: input.branchId,
      stock: { gte: input.quantity },
    },
    data: { stock: { decrement: input.quantity } },
  });

  if (reserved.count !== 1) {
    return null;
  }

  const row = await tx.productStock.findUnique({
    where: {
      productId_branchId: {
        productId: input.productId,
        branchId: input.branchId,
      },
    },
    select: { stock: true },
  });

  return row?.stock ?? 0;
}

/**
 * D10-4 restore: returns the units an order holds exactly once. The CAS on
 * `stockHeldQty` (> 0 → 0) is the single restore point shared by the unpaid
 * cancel, the refunded cancel, a FULL_REFUND dispute before handover and the
 * expiry cron (plus its CANCELLED reconciliation sweep); a second caller
 * finds nothing to restore. The upsert survives a ProductStock row removed
 * while the order was open. Writes the RELEASE movement. Returns the
 * restored units.
 */
export async function restoreHeldStock(
  tx: StockDb,
  input: {
    orderId: string;
    actorUserId?: string | null;
    reason?: string | null;
  },
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

  const row = await tx.productStock.upsert({
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
    select: { stock: true },
  });

  await recordStockMovement(tx, {
    productId: order.productId,
    branchId: order.branchId,
    type: StockMovementType.RELEASE,
    quantity: order.stockHeldQty,
    stockAfter: row.stock,
    orderId: input.orderId,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
  });

  return order.stockHeldQty;
}

/**
 * F10 review L1: the goods were handed over (DELIVERED / PICKED_UP), so the
 * hold becomes final. `stockHeldQty` drops to 0 *without* returning units:
 * a later FULL_REFUND must not resurrect stock that left with the customer,
 * and the admin "units still reserved" stops counting delivered orders. No
 * ledger row: the units already left `stock` with the RESERVE.
 */
export async function consumeHeldStock(
  tx: Pick<Prisma.TransactionClient, "order">,
  input: { orderId: string },
): Promise<void> {
  await tx.order.updateMany({
    where: { id: input.orderId, stockHeldQty: { gt: 0 } },
    data: { stockHeldQty: 0 },
  });
}
