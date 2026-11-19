import type { Prisma, PrismaClient } from "@generated/prisma";

import {
  PLATFORM_CATALOG_PAGE_SIZE,
  type ListPlatformProductsInput,
  type ListPlatformServicesInput,
} from "~/schemas/admin/platform-catalog.schema";

type CatalogDb = Pick<PrismaClient, "product" | "service">;

const businessSelect = {
  select: { id: true, name: true, status: true },
} satisfies Prisma.BusinessDefaultArgs;

function contains(term: string) {
  return { contains: term, mode: "insensitive" as const };
}

function paginate<TRow>(rows: TRow[], idOf: (row: TRow) => string) {
  const hasNextPage = rows.length > PLATFORM_CATALOG_PAGE_SIZE;
  const items = hasNextPage ? rows.slice(0, PLATFORM_CATALOG_PAGE_SIZE) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasNextPage && last ? idOf(last) : null,
  };
}

const productSelect = {
  id: true,
  name: true,
  sku: true,
  category: true,
  priceCents: true,
  status: true,
  imageUrl: true,
  createdAt: true,
  business: businessSelect,
  stocks: { select: { stock: true } },
} satisfies Prisma.ProductSelect;

function productWhere(
  input: ListPlatformProductsInput,
): Prisma.ProductWhereInput {
  const term = input.search?.trim() ?? "";

  return {
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: contains(input.category) } : {}),
    ...(term.length > 0
      ? {
          OR: [
            { name: contains(term) },
            { sku: contains(term) },
            { description: contains(term) },
            { category: contains(term) },
            { business: { is: { name: contains(term) } } },
          ],
        }
      : {}),
  };
}

/** Every product on the platform, across businesses (admin read-only). */
export async function listPlatformProducts(
  deps: { db: CatalogDb },
  input: ListPlatformProductsInput,
) {
  const where = productWhere(input);
  const [rows, total] = await Promise.all([
    deps.db.product.findMany({
      where,
      take: PLATFORM_CATALOG_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: productSelect,
    }),
    deps.db.product.count({ where }),
  ]);
  const page = paginate(rows, (row) => row.id);

  return {
    total,
    nextCursor: page.nextCursor,
    items: page.items.map(({ stocks, ...product }) => ({
      ...product,
      totalStock: stocks.reduce((sum, row) => sum + row.stock, 0),
    })),
  };
}

const serviceSelect = {
  id: true,
  name: true,
  category: true,
  categories: true,
  basePriceCents: true,
  durationMinutes: true,
  durationMaxMinutes: true,
  diagnosticPriceCents: true,
  diagnosticCredited: true,
  status: true,
  imageUrl: true,
  createdAt: true,
  business: businessSelect,
} satisfies Prisma.ServiceSelect;

function diagnosticWhere(
  diagnostic: ListPlatformServicesInput["diagnostic"],
): Prisma.ServiceWhereInput {
  switch (diagnostic) {
    case "configured":
      return { diagnosticPriceCents: { not: null } };
    case "credited":
      return { diagnosticPriceCents: { not: null }, diagnosticCredited: true };
    case "not_credited":
      return { diagnosticPriceCents: { not: null }, diagnosticCredited: false };
    case "none":
      return { diagnosticPriceCents: null };
    case "any":
      return {};
  }
}

function serviceWhere(
  input: ListPlatformServicesInput,
): Prisma.ServiceWhereInput {
  const term = input.search?.trim() ?? "";

  return {
    ...diagnosticWhere(input.diagnostic),
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.category
      ? {
          OR: [
            { category: contains(input.category) },
            { categories: { has: input.category } },
          ],
        }
      : {}),
    ...(term.length > 0
      ? {
          AND: [
            {
              OR: [
                { name: contains(term) },
                { description: contains(term) },
                { category: contains(term) },
                { business: { is: { name: contains(term) } } },
              ],
            },
          ],
        }
      : {}),
  };
}

/** Every service on the platform, across businesses (admin read-only). */
export async function listPlatformServices(
  deps: { db: CatalogDb },
  input: ListPlatformServicesInput,
) {
  const where = serviceWhere(input);
  const [rows, total] = await Promise.all([
    deps.db.service.findMany({
      where,
      take: PLATFORM_CATALOG_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: serviceSelect,
    }),
    deps.db.service.count({ where }),
  ]);
  const page = paginate(rows, (row) => row.id);

  return { total, nextCursor: page.nextCursor, items: page.items };
}
