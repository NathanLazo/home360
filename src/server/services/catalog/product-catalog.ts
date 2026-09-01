import "server-only";

import {
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
            select: { productId: true },
          });
          const stockedProductIds = new Set(
            existingStocks.map(({ productId }) => productId),
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
        },
        select: { id: true },
      });

      if (input.stocks) {
        const includedBranchIds = input.stocks.map(({ branchId }) => branchId);

        await tx.productStock.deleteMany({
          where: {
            productId: input.id,
            branch: { businessId },
            ...(includedBranchIds.length > 0
              ? { branchId: { notIn: includedBranchIds } }
              : {}),
          },
        });

        await Promise.all(
          input.stocks.map((stock) =>
            tx.productStock.upsert({
              where: {
                productId_branchId: {
                  productId: input.id,
                  branchId: stock.branchId,
                },
              },
              create: {
                productId: input.id,
                branchId: stock.branchId,
                stock: stock.stock,
                lowStockThreshold: stock.lowStockThreshold,
              },
              update: {
                stock: stock.stock,
                lowStockThreshold: stock.lowStockThreshold,
              },
            }),
          ),
        );
      }

      return ok(product, "Product updated");
    });
  } catch (error) {
    if (isSkuConflict(error)) {
      return fail("SKU_TAKEN", 409, "Product SKU is already in use");
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
