import "server-only";

import {
  OrderStatus,
  Prisma,
  type PrismaClient,
  type ProductStatus,
} from "@generated/prisma";
import type {
  CsvRowError,
  ProductCreateInput,
  ProductCsvRow,
  ProductErrorCode,
  ProductListInput,
  ProductUpdateInput,
} from "~/app/[locale]/dashboard/products/_components/product.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { ACTIVE_ORDER_STATUSES } from "~/server/services/business/order-activity";
import { assertBranchInBusiness } from "~/server/services/business/branch-access";
import {
  recordStockAdjustments,
  type StockAdjustment,
} from "~/server/services/orders/stock-hold";
import {
  assertPlanLimit,
  type BusinessWithPlan,
} from "~/server/services/subscription/plan-limits";

const PAGE_SIZE = 20;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const IMPORT_MAX_SERIALIZABLE_ATTEMPTS = 3;
const IMPORT_WRITE_BATCH_SIZE = 100;
// A 500-row import is a bounded back-office operation. Thirty seconds leaves
// room for its bulk phases without inheriting Prisma's short interactive default.
const IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;

const productListSelect = {
  id: true,
  name: true,
  sku: true,
  category: true,
  priceCents: true,
  imageUrl: true,
  status: true,
  createdAt: true,
  stocks: {
    select: {
      branchId: true,
      stock: true,
      lowStockThreshold: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ProductListRow = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;

export type ProductListItem = Omit<ProductListRow, "stocks"> & {
  stock: number;
  isCarried: boolean;
  isLowStock: boolean;
  branchesCarrying: number;
  branchesWithLowStock: number;
};

type ProductListResult = {
  items: ProductListItem[];
  nextCursor: string | null;
  totals: {
    count: number;
    lowStockCount: number;
  };
};

const stockBranchSelect = {
  id: true,
  name: true,
  status: true,
} satisfies Prisma.BranchSelect;

export type ProductStockBranch = Prisma.BranchGetPayload<{
  select: typeof stockBranchSelect;
}>;

export type ProductStockByBranch = {
  branchId: string;
  branchName: string;
  branchStatus: ProductStockBranch["status"];
  isCarried: boolean;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
};

type ProductResponse<T> = TrpcResponse<T, ProductErrorCode>;

export type ProductImportResult = {
  created: number;
  updated: number;
  errors: CsvRowError[];
};

function isSkuConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isImportConcurrencyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

function inBatches<T>(items: readonly T[]): T[][] {
  const batches: T[][] = [];

  for (
    let offset = 0;
    offset < items.length;
    offset += IMPORT_WRITE_BATCH_SIZE
  ) {
    batches.push(items.slice(offset, offset + IMPORT_WRITE_BATCH_SIZE));
  }

  return batches;
}

type ImportedProductWrite = { id: string; row: ProductCsvRow };

function requiredImportRow(
  rowsBySku: ReadonlyMap<string, ProductCsvRow>,
  sku: string,
): ProductCsvRow {
  const row = rowsBySku.get(sku);

  if (!row) {
    throw new Error(`Missing normalized import row for SKU ${sku}`);
  }

  return row;
}

async function updateImportedProducts(
  tx: Prisma.TransactionClient,
  products: readonly ImportedProductWrite[],
): Promise<void> {
  for (const batch of inBatches(products)) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Product" AS product
      SET
        "name" = imported.name,
        "category" = imported.category,
        "priceCents" = imported.price_cents,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(
          batch.map(
            ({ id, row }) =>
              Prisma.sql`(${id}, ${row.name}, ${row.category}, ${row.priceCents})`,
          ),
        )}
      ) AS imported(id, name, category, price_cents)
      WHERE product.id = imported.id
    `);
  }
}

async function updateImportedStocks(
  tx: Prisma.TransactionClient,
  branchId: string,
  products: readonly ImportedProductWrite[],
): Promise<void> {
  for (const batch of inBatches(products)) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "ProductStock" AS product_stock
      SET
        "stock" = imported.stock,
        "lowStockThreshold" = imported.low_stock_threshold,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(
          batch.map(
            ({ id, row }) =>
              Prisma.sql`(${id}, ${row.stock}, ${row.lowStockThreshold})`,
          ),
        )}
      ) AS imported(product_id, stock, low_stock_threshold)
      WHERE product_stock."productId" = imported.product_id
        AND product_stock."branchId" = ${branchId}
    `);
  }
}

async function stocksBelongToBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
  stocks: readonly { branchId: string }[],
): Promise<boolean> {
  const branchIds = [...new Set(stocks.map(({ branchId }) => branchId))];

  if (branchIds.length !== stocks.length) {
    return false;
  }

  if (branchIds.length === 0) {
    return true;
  }

  const branchCount = await tx.branch.count({
    where: { businessId, id: { in: branchIds } },
  });

  return branchCount === branchIds.length;
}

function mapProductListItem(row: ProductListRow): ProductListItem {
  const { stocks, ...product } = row;
  const branchesWithLowStock = stocks.filter(
    ({ stock, lowStockThreshold }) => stock <= lowStockThreshold,
  ).length;

  return {
    ...product,
    stock: stocks.reduce((total, current) => total + current.stock, 0),
    isCarried: stocks.length > 0,
    isLowStock: branchesWithLowStock > 0,
    branchesCarrying: stocks.length,
    branchesWithLowStock,
  };
}

export async function listProducts(
  db: PrismaClient,
  businessId: string,
  input: ProductListInput,
): Promise<ProductResponse<ProductListResult>> {
  if (
    input.branchId &&
    !(await assertBranchInBusiness(db, businessId, input.branchId))
  ) {
    return fail("NOT_FOUND", 404, "Branch not found");
  }

  if (input.cursor) {
    const cursor = await db.product.findFirst({
      where: { id: input.cursor, businessId },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Product cursor not found");
    }
  }

  const baseWhere: Prisma.ProductWhereInput = {
    businessId,
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { sku: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
  const lowStockWhere: Prisma.ProductWhereInput = {
    stocks: {
      some: {
        ...(input.branchId ? { branchId: input.branchId } : {}),
        stock: { lte: db.productStock.fields.lowStockThreshold },
      },
    },
  };
  const where: Prisma.ProductWhereInput = input.lowStockOnly
    ? { AND: [baseWhere, lowStockWhere] }
    : baseWhere;

  const [rows, count, lowStockCount] = await Promise.all([
    db.product.findMany({
      where,
      take: PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        ...productListSelect,
        stocks: {
          ...(input.branchId ? { where: { branchId: input.branchId } } : {}),
          select: productListSelect.stocks.select,
        },
      },
    }),
    db.product.count({ where: baseWhere }),
    db.product.count({ where: { AND: [baseWhere, lowStockWhere] } }),
  ]);
  const hasNextPage = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  return ok(
    {
      items: page.map(mapProductListItem),
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
      totals: { count, lowStockCount },
    },
    "Products loaded",
  );
}

export async function listProductStockBranches(
  db: PrismaClient,
  businessId: string,
): Promise<ProductResponse<ProductStockBranch[]>> {
  const branches = await db.branch.findMany({
    where: { businessId },
    select: stockBranchSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return ok(branches, "Product stock branches loaded");
}

export async function getProductStockByBranch(
  db: PrismaClient,
  businessId: string,
  productId: string,
): Promise<ProductResponse<ProductStockByBranch[]>> {
  const product = await db.product.findFirst({
    where: { id: productId, businessId },
    select: {
      id: true,
      stocks: {
        select: {
          branchId: true,
          stock: true,
          lowStockThreshold: true,
        },
      },
    },
  });

  if (!product) {
    return fail("NOT_FOUND", 404, "Product not found");
  }

  const branches = await db.branch.findMany({
    where: { businessId },
    select: stockBranchSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const stockByBranchId = new Map(
    product.stocks.map((stock) => [stock.branchId, stock]),
  );

  return ok(
    branches.map((branch) => {
      const productStock = stockByBranchId.get(branch.id);

      return {
        branchId: branch.id,
        branchName: branch.name,
        branchStatus: branch.status,
        isCarried: productStock !== undefined,
        stock: productStock?.stock ?? 0,
        lowStockThreshold:
          productStock?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
        isLowStock:
          productStock !== undefined &&
          productStock.stock <= productStock.lowStockThreshold,
      };
    }),
    "Product stock loaded",
  );
}

export async function listProductCategories(
  db: PrismaClient,
  businessId: string,
): Promise<ProductResponse<string[]>> {
  const categories = await db.product.groupBy({
    by: ["category"],
    where: { businessId },
    orderBy: { category: "asc" },
  });

  return ok(
    categories.map(({ category }) => category),
    "Product categories loaded",
  );
}

export async function importProductRows(
  db: PrismaClient,
  businessId: string,
  branchId: string,
  rows: ProductCsvRow[],
  actorUserId?: string,
): Promise<ProductResponse<ProductImportResult>> {
  const seenSkus = new Set<string>();
  const uniqueRows: ProductCsvRow[] = [];
  const errors: CsvRowError[] = [];

  for (const row of rows) {
    if (seenSkus.has(row.sku)) {
      errors.push({ line: row.line, code: "DUPLICATE_SKU_IN_FILE" });
      continue;
    }

    seenSkus.add(row.sku);
    uniqueRows.push(row);
  }

  const skus = uniqueRows.map(({ sku }) => sku);
  const rowBySku = new Map(uniqueRows.map((row) => [row.sku, row]));

  for (
    let transactionAttempt = 0;
    transactionAttempt < IMPORT_MAX_SERIALIZABLE_ATTEMPTS;
    transactionAttempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          const branch = await tx.branch.findFirst({
            where: { id: branchId, businessId },
            select: { id: true },
          });

          if (!branch) {
            return fail("NOT_FOUND", 404, "Branch not found");
          }

          // Classification belongs to this serializable snapshot so counters
          // describe the same state that the writes commit against.
          const existingProducts = await tx.product.findMany({
            where: { businessId, sku: { in: skus } },
            select: { id: true, sku: true },
          });
          const existingSkus = new Set(existingProducts.map(({ sku }) => sku));
          const newRows = uniqueRows.filter(
            ({ sku }) => !existingSkus.has(sku),
          );

          if (newRows.length > 0) {
            await tx.product.createMany({
              data: newRows.map((row) => ({
                businessId,
                name: row.name,
                sku: row.sku,
                category: row.category,
                priceCents: row.priceCents,
                status: "DRAFT",
              })),
            });
          }

          await updateImportedProducts(
            tx,
            existingProducts.map((product) => ({
              id: product.id,
              row: requiredImportRow(rowBySku, product.sku),
            })),
          );

          const importedProducts = await tx.product.findMany({
            where: { businessId, sku: { in: skus } },
            select: { id: true, sku: true },
          });

          if (importedProducts.length !== uniqueRows.length) {
            throw new Error(
              "Product import did not materialize every unique SKU",
            );
          }

          const productWrites = importedProducts.map((product) => ({
            id: product.id,
            row: requiredImportRow(rowBySku, product.sku),
          }));
          const existingStocks = await tx.productStock.findMany({
            where: {
              branchId,
              productId: { in: importedProducts.map(({ id }) => id) },
            },
            select: { productId: true, stock: true },
          });
          const stockedProductIds = new Set(
            existingStocks.map(({ productId }) => productId),
          );
          const stockBefore = new Map(
            existingStocks.map(({ productId, stock }) => [productId, stock]),
          );
          const newStocks = productWrites.filter(
            ({ id }) => !stockedProductIds.has(id),
          );
          const stocksToUpdate = productWrites.filter(({ id }) =>
            stockedProductIds.has(id),
          );

          if (newStocks.length > 0) {
            await tx.productStock.createMany({
              data: newStocks.map(({ id, row }) => ({
                productId: id,
                branchId,
                stock: row.stock,
                lowStockThreshold: row.lowStockThreshold,
              })),
            });
          }

          await updateImportedStocks(tx, branchId, stocksToUpdate);
          // F10-b: one ADJUST row per stock the import changed.
          await recordStockAdjustments(
            tx,
            productWrites.map(({ id, row }) => ({
              productId: id,
              branchId,
              before: stockBefore.get(id) ?? 0,
              after: row.stock,
            })),
            { actorUserId, reason: "CSV_IMPORT" },
          );

          return ok(
            {
              created: newRows.length,
              updated: existingProducts.length,
              errors,
            },
            "Products imported",
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (!isImportConcurrencyConflict(error)) {
        throw error;
      }
    }
  }

  return fail("CONFLICT", 409, "Product import conflicted; try again");
}

export async function createProduct(
  db: PrismaClient,
  business: BusinessWithPlan,
  input: ProductCreateInput,
  actorUserId?: string,
): Promise<ProductResponse<{ id: string }>> {
  if (input.status === "PUBLISHED") {
    const limitFailure = await assertPlanLimit(db, business, "products");

    if (limitFailure) {
      return limitFailure;
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      if (!(await stocksBelongToBusiness(tx, business.id, input.stocks))) {
        return fail(
          "VALIDATION_ERROR",
          422,
          "Some stock branches do not belong to the business",
        );
      }

      const product = await tx.product.create({
        data: {
          businessId: business.id,
          name: input.name,
          sku: input.sku,
          category: input.category,
          priceCents: input.priceCents,
          imageUrl: input.imageUrl ?? null,
          status: input.status,
          stocks: {
            create: input.stocks.map((stock) => ({
              branchId: stock.branchId,
              stock: stock.stock,
              lowStockThreshold: stock.lowStockThreshold,
            })),
          },
        },
        select: { id: true },
      });

      await recordStockAdjustments(
        tx,
        input.stocks.map((stock) => ({
          productId: product.id,
          branchId: stock.branchId,
          before: 0,
          after: stock.stock,
        })),
        { actorUserId, reason: "PRODUCT_CREATED" },
      );

      return ok(product, "Product created", 201);
    });
  } catch (error) {
    if (isSkuConflict(error)) {
      return fail("SKU_TAKEN", 409, "Product SKU is already in use");
    }

    throw error;
  }
}

export async function updateProduct(
  db: PrismaClient,
  businessId: string,
  input: ProductUpdateInput,
  actorUserId?: string,
): Promise<ProductResponse<{ id: string }>> {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findFirst({
        where: { id: input.id, businessId },
        select: { id: true },
      });

      if (!current) {
        return fail("NOT_FOUND", 404, "Product not found");
      }

      if (
        input.stocks &&
        !(await stocksBelongToBusiness(tx, businessId, input.stocks))
      ) {
        return fail(
          "VALIDATION_ERROR",
          422,
          "Some stock branches do not belong to the business",
        );
      }

      const product = await tx.product.update({
        where: { id: input.id, businessId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.priceCents !== undefined
            ? { priceCents: input.priceCents }
            : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        },
        select: { id: true },
      });

      if (input.stocks) {
        await applyStockChanges(tx, {
          businessId,
          productId: input.id,
          stocks: input.stocks,
          actorUserId,
        });
      }

      return ok(product, "Product updated");
    });
  } catch (error) {
    if (isSkuConflict(error)) {
      return fail("SKU_TAKEN", 409, "Product SKU is already in use");
    }

    if (error instanceof StockChangedError) {
      return fail("CONFLICT", 409, error.message);
    }

    throw error;
  }
}

/**
 * Order states whose reservation may still be restored (D10-4): a COMPLETED
 * order consumed its units, a CANCELLED one already gave them back.
 */
const STOCK_HOLDING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.SHIPPING,
  OrderStatus.DISPUTED,
];

export type StockChange = {
  branchId: string;
  stock: number;
  lowStockThreshold: number;
  /**
   * D10-4 optimistic precondition: the available stock the editor saw. When
   * present the write only applies if it still matches (else CONFLICT), so a
   * sale reserved meanwhile is never overwritten.
   */
  expectedStock?: number;
};

class StockChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockChangedError";
  }
}

/**
 * Replace-all stock edit inside the caller's transaction. Branches left out
 * stop carrying the product — refused while an open order still holds units
 * there (its restore would resurrect the row). Rows with `expectedStock` are
 * compare-and-set; rows without it keep the legacy absolute write. Every
 * changed row writes its F10-b ADJUST movement in this same transaction.
 */
async function applyStockChanges(
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    productId: string;
    stocks: readonly StockChange[];
    actorUserId?: string;
  },
): Promise<void> {
  const adjustments: StockAdjustment[] = [];
  const includedBranchIds = input.stocks.map(({ branchId }) => branchId);
  const removedHeld = await tx.order.count({
    where: {
      productId: input.productId,
      stockHeldQty: { gt: 0 },
      status: { in: STOCK_HOLDING_ORDER_STATUSES },
      branch: { businessId: input.businessId },
      ...(includedBranchIds.length > 0
        ? { branchId: { notIn: includedBranchIds } }
        : {}),
    },
  });

  if (removedHeld > 0) {
    throw new StockChangedError("A removed branch still holds reserved units");
  }

  const removedWhere = {
    productId: input.productId,
    branch: { businessId: input.businessId },
    ...(includedBranchIds.length > 0
      ? { branchId: { notIn: includedBranchIds } }
      : {}),
  } satisfies Prisma.ProductStockWhereInput;
  const removed = await tx.productStock.findMany({
    where: removedWhere,
    select: { branchId: true, stock: true },
  });

  await tx.productStock.deleteMany({ where: removedWhere });
  await recordStockAdjustments(
    tx,
    removed.map((row) => ({
      productId: input.productId,
      branchId: row.branchId,
      before: row.stock,
      after: 0,
    })),
    { actorUserId: input.actorUserId, reason: "BRANCH_REMOVED" },
  );

  for (const stock of input.stocks) {
    if (stock.expectedStock === undefined) {
      const previous = await tx.productStock.findUnique({
        where: {
          productId_branchId: {
            productId: input.productId,
            branchId: stock.branchId,
          },
        },
        select: { stock: true },
      });

      adjustments.push({
        productId: input.productId,
        branchId: stock.branchId,
        before: previous?.stock ?? 0,
        after: stock.stock,
      });
      await tx.productStock.upsert({
        where: {
          productId_branchId: {
            productId: input.productId,
            branchId: stock.branchId,
          },
        },
        create: {
          productId: input.productId,
          branchId: stock.branchId,
          stock: stock.stock,
          lowStockThreshold: stock.lowStockThreshold,
        },
        update: {
          stock: stock.stock,
          lowStockThreshold: stock.lowStockThreshold,
        },
      });
      continue;
    }

    const changed = await tx.productStock.updateMany({
      where: {
        productId: input.productId,
        branchId: stock.branchId,
        stock: stock.expectedStock,
      },
      data: {
        stock: stock.stock,
        lowStockThreshold: stock.lowStockThreshold,
      },
    });

    if (changed.count === 1) {
      adjustments.push({
        productId: input.productId,
        branchId: stock.branchId,
        before: stock.expectedStock,
        after: stock.stock,
      });
      continue;
    }

    const existing = await tx.productStock.findUnique({
      where: {
        productId_branchId: {
          productId: input.productId,
          branchId: stock.branchId,
        },
      },
      select: { id: true },
    });

    // A branch that did not carry the product yet starts from 0.
    if (existing || stock.expectedStock !== 0) {
      throw new StockChangedError("Stock changed since it was read");
    }

    await tx.productStock.create({
      data: {
        productId: input.productId,
        branchId: stock.branchId,
        stock: stock.stock,
        lowStockThreshold: stock.lowStockThreshold,
      },
    });
    adjustments.push({
      productId: input.productId,
      branchId: stock.branchId,
      before: 0,
      after: stock.stock,
    });
  }

  await recordStockAdjustments(tx, adjustments, {
    actorUserId: input.actorUserId,
    reason: "STOCK_EDIT",
  });
}

/**
 * `product.adjustStock` (D10-4): per-branch stock edit with an optional
 * `expectedStock` precondition per row; a stale row answers CONFLICT.
 */
export async function adjustProductStock(
  db: PrismaClient,
  businessId: string,
  input: { id: string; stocks: StockChange[] },
  actorUserId?: string,
): Promise<ProductResponse<{ id: string }>> {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findFirst({
        where: { id: input.id, businessId },
        select: { id: true },
      });

      if (!current) {
        return fail("NOT_FOUND", 404, "Product not found");
      }

      if (!(await stocksBelongToBusiness(tx, businessId, input.stocks))) {
        return fail(
          "VALIDATION_ERROR",
          422,
          "Some stock branches do not belong to the business",
        );
      }

      await applyStockChanges(tx, {
        businessId,
        productId: input.id,
        stocks: input.stocks,
        actorUserId,
      });

      return ok({ id: current.id }, "Product stock updated");
    });
  } catch (error) {
    if (error instanceof StockChangedError) {
      return fail("CONFLICT", 409, error.message);
    }

    throw error;
  }
}

export async function setProductStatus(
  db: PrismaClient,
  business: BusinessWithPlan,
  input: { id: string; status: ProductStatus },
): Promise<ProductResponse<{ id: string; status: ProductStatus }>> {
  const current = await db.product.findFirst({
    where: { id: input.id, businessId: business.id },
    select: { id: true, status: true },
  });

  if (!current) {
    return fail("NOT_FOUND", 404, "Product not found");
  }

  if (current.status !== "PUBLISHED" && input.status === "PUBLISHED") {
    const limitFailure = await assertPlanLimit(db, business, "products");

    if (limitFailure) {
      return limitFailure;
    }
  }

  const product = await db.product.update({
    where: { id: input.id, businessId: business.id },
    data: { status: input.status },
    select: { id: true, status: true },
  });

  return ok(product, "Product status updated");
}

export async function deleteProduct(
  db: PrismaClient,
  businessId: string,
  id: string,
): Promise<ProductResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!product) {
      return fail("NOT_FOUND", 404, "Product not found");
    }

    const activeOrders = await tx.order.count({
      where: {
        businessId,
        productId: id,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
    });

    if (activeOrders > 0) {
      return fail("CONFLICT", 409, "Product has active orders");
    }

    await tx.product.delete({ where: { id, businessId } });

    return ok({ id }, "Product deleted");
  });
}
