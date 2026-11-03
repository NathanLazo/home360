import "server-only";

import type { Prisma, PrismaClient } from "@generated/prisma";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { marketplaceBusinessWhere } from "~/server/services/catalog/marketplace-business";
import {
  compareDistance,
  nearestStockKm,
  productBranchStockSelect,
  sellableStockWhere,
  summarizeAvailability,
  type ProductAvailability,
} from "~/server/services/catalog/product-availability";
import type { GeoPoint } from "~/server/services/geo/haversine";

const SEARCH_PAGE_SIZE = 20;
const FEATURED_PRODUCTS_TAKE = 10;
/** F11: candidate pool ranked by proximity before cutting to the feed size. */
const FEATURED_CANDIDATES_TAKE = 100;

export const MARKETPLACE_KINDS = ["service", "product"] as const;

export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number];

export type MarketplaceSearchInput = {
  query: string;
  kind?: MarketplaceKind;
  cursor?: string;
  /** F11: distance origin (explicit point or default address). */
  origin: GeoPoint | null;
};

/** Stock rows a customer can buy from, for proximity ranking. */
const sellableStocksSelect = {
  where: { ...sellableStockWhere, stock: { gt: 0 } },
  select: productBranchStockSelect,
} satisfies Prisma.Product$stocksArgs;

/**
 * The marketplace is the customer-facing, cross-tenant read model: it only ever
 * surfaces ACTIVE businesses and their published catalog, and never exposes
 * owner ids or financial data.
 */
// F10 review L6: ACTIVE and not CANCELED (the `activeBusinessProcedure` rule).
const activeBusinessFilter = marketplaceBusinessWhere;

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
  imageUrl: true,
  businessId: true,
  business: { select: { name: true } },
  stocks: sellableStocksSelect,
} satisfies Prisma.ProductSelect;

export type MarketplaceFeaturedProduct = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  businessId: string;
  businessName: string;
  /** F11: km to the nearest location with stock; null without origin/geo. */
  distanceKm: number | null;
};

const serviceSearchSelect = {
  id: true,
  name: true,
  category: true,
  basePriceCents: true,
  businessId: true,
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
  imageUrl: true,
  businessId: true,
  business: { select: { name: true } },
  stocks: sellableStocksSelect,
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
  businessId: string;
  businessName: string;
  /** Product photo; services have no image. */
  imageUrl: string | null;
  /** F11: products only — km to the nearest location with stock. */
  distanceKm: number | null;
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
  imageUrl: true,
  businessId: true,
  stocks: { select: productBranchStockSelect },
  business: { select: { name: true, ratingAvg: true, ratingCount: true } },
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
  businessId: string;
  /** Same as `available` (kept for pre-F10 clients; never the raw sum). */
  stock: number;
  /** Max units at a single eligible branch (D10-6): cap the quantity here. */
  available: ProductAvailability["available"];
  lowStock: ProductAvailability["lowStock"];
  fulfillment: ProductAvailability["fulfillment"];
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
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return ok(categories, "Marketplace categories loaded");
}

/**
 * F11 recommendations: in-stock products nearest to the origin first (the
 * closest store or warehouse holding units). The pool is pre-ordered by
 * business rating (M3-W0) then recency, so that order breaks distance ties
 * and is the whole ranking when there is no origin.
 */
export async function listFeaturedProducts(
  db: PrismaClient,
  origin: GeoPoint | null,
): Promise<TrpcResponse<MarketplaceFeaturedProduct[]>> {
  const candidates = await db.product.findMany({
    where: {
      ...productCatalogFilter,
      stocks: { some: { ...sellableStockWhere, stock: { gt: 0 } } },
    },
    select: featuredProductSelect,
    orderBy: [
      { business: { ratingAvg: { sort: "desc", nulls: "last" } } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: FEATURED_CANDIDATES_TAKE,
  });
  const ranked = candidates
    .map((product, rank) => ({
      rank,
      item: {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        businessId: product.businessId,
        businessName: product.business.name,
        distanceKm: nearestStockKm(product.stocks, origin),
      },
    }))
    .sort(
      (a, b) =>
        compareDistance(a.item.distanceKm, b.item.distanceKm) ||
        a.rank - b.rank,
    )
    .slice(0, FEATURED_PRODUCTS_TAKE)
    .map(({ item }) => item);

  return ok(ranked, "Featured products loaded");
}

function serviceSearchItem(row: ServiceSearchRow): MarketplaceSearchItem {
  return {
    kind: "service",
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.basePriceCents,
    businessId: row.businessId,
    businessName: row.business.name,
    imageUrl: null,
    distanceKm: null,
  };
}

function productSearchItem(
  row: ProductSearchRow,
  origin: GeoPoint | null,
): MarketplaceSearchItem {
  return {
    kind: "product",
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.priceCents,
    businessId: row.businessId,
    businessName: row.business.name,
    imageUrl: row.imageUrl,
    distanceKm: nearestStockKm(row.stocks, origin),
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

    items.push(...page.map((row) => productSearchItem(row, input.origin)));

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

/**
 * Product detail with D10-6 availability: the max units at one eligible
 * branch, low-stock flag and the fulfillment options (delivery, pickup
 * branches nearest to `origin` first). Origin = the given point or null.
 */
export async function getMarketplaceProduct(
  db: PrismaClient,
  id: string,
  origin: GeoPoint | null = null,
): Promise<TrpcResponse<MarketplaceProductDetail>> {
  const product: ProductDetailRow | null = await db.product.findFirst({
    where: { id, ...productCatalogFilter },
    select: productDetailSelect,
  });

  if (!product) {
    return fail("NOT_FOUND", 404, "Product not found");
  }

  const availability = summarizeAvailability(product.stocks, origin);

  return ok(
    {
      id: product.id,
      name: product.name,
      category: product.category,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      businessId: product.businessId,
      stock: availability.available,
      available: availability.available,
      lowStock: availability.lowStock,
      fulfillment: availability.fulfillment,
      business: {
        name: product.business.name,
        ratingAvg: product.business.ratingAvg,
        ratingCount: product.business.ratingCount,
      },
    },
    "Marketplace product loaded",
  );
}
