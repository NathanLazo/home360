import "server-only";

import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";

const SEARCH_PAGE_SIZE = 20;
const FEATURED_PRODUCTS_TAKE = 10;
// Featured ranking sorts by business rating, which is not a column, so the
// candidate pool is bounded to keep the query cheap. Newest products win the
// spot when the pool overflows.
const FEATURED_CANDIDATE_POOL = 200;

export const MARKETPLACE_KINDS = ["service", "product"] as const;

export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number];

export type MarketplaceSearchInput = {
  query: string;
  kind?: MarketplaceKind;
  cursor?: string;
};

/**
 * The marketplace is the customer-facing, cross-tenant read model: it only ever
 * surfaces ACTIVE businesses and their published catalog, and never exposes
 * owner ids or financial data.
 */
const activeBusinessFilter = {
  status: "ACTIVE",
} satisfies Prisma.BusinessWhereInput;

export const serviceCatalogFilter = {
  status: "ACTIVE",
  business: activeBusinessFilter,
} satisfies Prisma.ServiceWhereInput;

export const productCatalogFilter = {
  status: "PUBLISHED",
  business: activeBusinessFilter,
} satisfies Prisma.ProductWhereInput;

export type MarketplaceCategory = {
  category: string;
  count: number;
};

const featuredProductSelect = {
  id: true,
  name: true,
  priceCents: true,
  business: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

type FeaturedProductRow = Prisma.ProductGetPayload<{
  select: typeof featuredProductSelect;
}>;

export type MarketplaceFeaturedProduct = {
  id: string;
  name: string;
  priceCents: number;
  // Products have no image column yet; the app renders its placeholder until
  // media lands for the catalog.
  imageUrl: string | null;
  businessName: string;
};

const serviceSearchSelect = {
  id: true,
  name: true,
  category: true,
  basePriceCents: true,
  business: { select: { name: true } },
} satisfies Prisma.ServiceSelect;

type ServiceSearchRow = Prisma.ServiceGetPayload<{
  select: typeof serviceSearchSelect;
}>;

const productSearchSelect = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
  business: { select: { name: true } },
} satisfies Prisma.ProductSelect;

type ProductSearchRow = Prisma.ProductGetPayload<{
  select: typeof productSearchSelect;
}>;

export type MarketplaceSearchItem = {
  kind: MarketplaceKind;
  id: string;
  name: string;
  category: string;
  priceCents: number;
  businessName: string;
};

export type MarketplaceSearchResult = {
  items: MarketplaceSearchItem[];
  nextCursor: string | null;
};

const productDetailSelect = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
  stocks: { select: { stock: true } },
  business: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

type ProductDetailRow = Prisma.ProductGetPayload<{
  select: typeof productDetailSelect;
}>;

export type MarketplaceProductDetail = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number;
  business: {
    name: string;
    ratingAvg: number | null;
    ratingCount: number;
  };
};

function isMarketplaceKind(value: string): value is MarketplaceKind {
  return (MARKETPLACE_KINDS as readonly string[]).includes(value);
}

function encodeCursor(kind: MarketplaceKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Search paginates across two tables, so the cursor carries the kind of the
 * last returned row alongside its id (`service:<id>` / `product:<id>`).
 */
function decodeCursor(
  cursor: string,
): { kind: MarketplaceKind; id: string } | null {
  const separator = cursor.indexOf(":");

  if (separator === -1) {
    return null;
  }

  const kind = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);

  if (!isMarketplaceKind(kind) || id.length === 0) {
    return null;
  }

  return { kind, id };
}

export type BusinessRating = {
  ratingAvg: number | null;
  ratingCount: number;
};

/**
 * Business rating lives on `Review` (per order), so it is aggregated through
 * `order.businessId`. Bounded by the featured candidate pool upstream.
 * Exported for reuse by the suggestion service (M2-W2).
 */
export async function getBusinessRatings(
  db: PrismaClient,
  businessIds: readonly string[],
): Promise<Map<string, BusinessRating>> {
  const ratings = new Map<string, BusinessRating>(
    businessIds.map((id) => [id, { ratingAvg: null, ratingCount: 0 }]),
  );

  if (businessIds.length === 0) {
    return ratings;
  }

  const reviews = await db.review.findMany({
    where: { order: { businessId: { in: [...businessIds] } } },
    select: { rating: true, order: { select: { businessId: true } } },
  });
  const totals = new Map<string, { sum: number; count: number }>();

  for (const review of reviews) {
    const businessId = review.order.businessId;
    const entry = totals.get(businessId) ?? { sum: 0, count: 0 };

    entry.sum += review.rating;
    entry.count += 1;
    totals.set(businessId, entry);
  }

  for (const [businessId, { sum, count }] of totals) {
    ratings.set(businessId, { ratingAvg: sum / count, ratingCount: count });
  }

  return ratings;
}

export async function listMarketplaceCategories(
  db: PrismaClient,
): Promise<TrpcResponse<MarketplaceCategory[]>> {
  const [serviceGroups, productGroups] = await Promise.all([
    db.service.groupBy({
      by: ["category"],
      where: serviceCatalogFilter,
      _count: { _all: true },
    }),
    db.product.groupBy({
      by: ["category"],
      where: productCatalogFilter,
      _count: { _all: true },
    }),
  ]);
  const countByCategory = new Map<string, number>();

  for (const group of [...serviceGroups, ...productGroups]) {
    countByCategory.set(
      group.category,
      (countByCategory.get(group.category) ?? 0) + group._count._all,
    );
  }

  const categories = [...countByCategory.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort(
      (a, b) => b.count - a.count || a.category.localeCompare(b.category),
    );

  return ok(categories, "Marketplace categories loaded");
}

export async function listFeaturedProducts(
  db: PrismaClient,
): Promise<TrpcResponse<MarketplaceFeaturedProduct[]>> {
  const candidates = await db.product.findMany({
    where: productCatalogFilter,
    select: featuredProductSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEATURED_CANDIDATE_POOL,
  });
  const ratings = await getBusinessRatings(db, [
    ...new Set(candidates.map((candidate) => candidate.business.id)),
  ]);
  const ratingOf = (row: FeaturedProductRow): number =>
    ratings.get(row.business.id)?.ratingAvg ?? -1;
  // Stable sort keeps the newest-first order within equal ratings; unrated
  // businesses rank last.
  const featured = [...candidates]
    .sort((a, b) => ratingOf(b) - ratingOf(a))
    .slice(0, FEATURED_PRODUCTS_TAKE);

  return ok(
    featured.map((product) => ({
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: null,
      businessName: product.business.name,
    })),
    "Featured products loaded",
  );
}

function serviceSearchItem(row: ServiceSearchRow): MarketplaceSearchItem {
  return {
    kind: "service",
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.basePriceCents,
    businessName: row.business.name,
  };
}

function productSearchItem(row: ProductSearchRow): MarketplaceSearchItem {
  return {
    kind: "product",
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.priceCents,
    businessName: row.business.name,
  };
}

/**
 * Cross-tenant search over both catalogs. Services page first, products fill
 * the remainder; the compound cursor resumes exactly where the previous page
 * stopped. A `service:` cursor whose row has no successors simply yields the
 * product phase on the next call.
 */
export async function searchMarketplace(
  db: PrismaClient,
  input: MarketplaceSearchInput,
): Promise<TrpcResponse<MarketplaceSearchResult>> {
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;

  if (input.cursor && !cursor) {
    return fail("VALIDATION_ERROR", 422, "Malformed marketplace cursor");
  }

  if (cursor && input.kind && cursor.kind !== input.kind) {
    return fail(
      "VALIDATION_ERROR",
      422,
      "Cursor does not match the requested kind",
    );
  }

  if (cursor) {
    const cursorRow =
      cursor.kind === "service"
        ? await db.service.findFirst({
            where: { id: cursor.id, ...serviceCatalogFilter },
            select: { id: true },
          })
        : await db.product.findFirst({
            where: { id: cursor.id, ...productCatalogFilter },
            select: { id: true },
          });

    if (!cursorRow) {
      return fail("NOT_FOUND", 404, "Marketplace cursor not found");
    }
  }

  const items: MarketplaceSearchItem[] = [];
  let nextCursor: string | null = null;
  let lastServiceId: string | null = null;
  const searchesServices =
    input.kind !== "product" && (!cursor || cursor.kind === "service");

  if (searchesServices) {
    const rows = await db.service.findMany({
      where: {
        ...serviceCatalogFilter,
        name: { contains: input.query, mode: "insensitive" },
      },
      select: serviceSearchSelect,
      take: SEARCH_PAGE_SIZE + 1,
      ...(cursor?.kind === "service"
        ? { cursor: { id: cursor.id }, skip: 1 }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const page = rows.slice(0, SEARCH_PAGE_SIZE);

    items.push(...page.map(serviceSearchItem));
    lastServiceId = page.at(-1)?.id ?? null;

    if (rows.length > SEARCH_PAGE_SIZE && lastServiceId) {
      nextCursor = encodeCursor("service", lastServiceId);
    }
  }

  const searchesProducts = input.kind !== "service" && nextCursor === null;

  if (searchesProducts) {
    const remaining = SEARCH_PAGE_SIZE - items.length;
    const rows = await db.product.findMany({
      where: {
        ...productCatalogFilter,
        name: { contains: input.query, mode: "insensitive" },
      },
      select: productSearchSelect,
      take: remaining + 1,
      ...(cursor?.kind === "product"
        ? { cursor: { id: cursor.id }, skip: 1 }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const page = rows.slice(0, remaining);

    items.push(...page.map(productSearchItem));

    if (rows.length > remaining) {
      const lastProductId = page.at(-1)?.id ?? null;

      if (lastProductId) {
        nextCursor = encodeCursor("product", lastProductId);
      } else if (lastServiceId) {
        // Services filled the whole page but products are pending: resume from
        // the last service row so the next page starts the product phase.
        nextCursor = encodeCursor("service", lastServiceId);
      }
    }
  }

  return ok({ items, nextCursor }, "Marketplace search loaded");
}

export async function getMarketplaceProduct(
  db: PrismaClient,
  id: string,
): Promise<TrpcResponse<MarketplaceProductDetail>> {
  const product: ProductDetailRow | null = await db.product.findFirst({
    where: { id, ...productCatalogFilter },
    select: productDetailSelect,
  });

  if (!product) {
    return fail("NOT_FOUND", 404, "Product not found");
  }

  const reviewAggregate = await db.review.aggregate({
    where: { order: { businessId: product.business.id } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return ok(
    {
      id: product.id,
      name: product.name,
      category: product.category,
      priceCents: product.priceCents,
      imageUrl: null,
      stock: product.stocks.reduce((total, { stock }) => total + stock, 0),
      business: {
        name: product.business.name,
        ratingAvg: reviewAggregate._avg.rating,
        ratingCount: reviewAggregate._count.rating,
      },
    },
    "Marketplace product loaded",
  );
}
