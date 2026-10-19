import "server-only";

import type {
  Prisma,
  PrismaClient,
  StockMovementType,
} from "@generated/prisma";

import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import type { StockMovementListInput } from "~/server/services/catalog/stock-movement.schema";

const STOCK_MOVEMENT_PAGE_SIZE = 20;
/** Movements shown on the admin order detail (F10-b). */
export const ORDER_STOCK_MOVEMENT_LIMIT = 20;

/** One ledger row as the dashboard and admin read it (dates as ISO). */
export type StockMovementItem = {
  id: string;
  type: StockMovementType;
  /** Signed change applied to the branch's available stock. */
  quantity: number;
  stockAfter: number;
  branchId: string;
  branchName: string;
  orderId: string | null;
  orderFolio: number | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
};

export type StockMovementPage = {
  items: StockMovementItem[];
  nextCursor: string | null;
};

const stockMovementSelect = {
  id: true,
  type: true,
  quantity: true,
  stockAfter: true,
  reason: true,
  createdAt: true,
  orderId: true,
  branch: { select: { id: true, name: true } },
  order: { select: { folio: true } },
  actor: { select: { name: true } },
} satisfies Prisma.StockMovementSelect;

type StockMovementRow = Prisma.StockMovementGetPayload<{
  select: typeof stockMovementSelect;
}>;

const stockMovementOrder = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.StockMovementOrderByWithRelationInput[];

function serializeStockMovement(row: StockMovementRow): StockMovementItem {
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    stockAfter: row.stockAfter,
    branchId: row.branch.id,
    branchName: row.branch.name,
    orderId: row.orderId,
    orderFolio: row.order?.folio ?? null,
    actorName: row.actor?.name ?? null,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * `product.listStockMovements` (F10-b): the ledger of one product of the
 * caller's business, newest first, optionally narrowed to a branch. The
 * business scope lives in the `where` (product and branch both belong to
 * it), so a foreign id simply finds nothing → NOT_FOUND.
 */
export async function listStockMovements(
  db: PrismaClient,
  businessId: string,
  input: StockMovementListInput,
): Promise<TrpcResponse<StockMovementPage>> {
  const product = await db.product.findFirst({
    where: { id: input.productId, businessId },
    select: { id: true },
  });

  if (!product) {
    return fail("NOT_FOUND", 404, "Product not found");
  }

  const rows = await db.stockMovement.findMany({
    where: {
      productId: product.id,
      branch: { businessId },
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
    orderBy: stockMovementOrder,
    take: STOCK_MOVEMENT_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: stockMovementSelect,
  });
  const page = rows.slice(0, STOCK_MOVEMENT_PAGE_SIZE);

  return ok(
    {
      items: page.map(serializeStockMovement),
      nextCursor:
        rows.length > STOCK_MOVEMENT_PAGE_SIZE
          ? (page.at(-1)?.id ?? null)
          : null,
    },
    "Stock movements loaded",
  );
}

/**
 * Admin order detail (F10-b): the latest movements of the order's product at
 * the order's branch, so support sees the reservation and its release next
 * to the surrounding edits.
 */
export async function listOrderStockMovements(
  db: Pick<PrismaClient, "stockMovement">,
  input: { productId: string; branchId: string },
): Promise<StockMovementItem[]> {
  const rows = await db.stockMovement.findMany({
    where: { productId: input.productId, branchId: input.branchId },
    orderBy: stockMovementOrder,
    take: ORDER_STOCK_MOVEMENT_LIMIT,
    select: stockMovementSelect,
  });

  return rows.map(serializeStockMovement);
}
