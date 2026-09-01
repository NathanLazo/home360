import "server-only";

import type { Prisma, PrismaClient } from "@generated/prisma";
import {
  productCatalogFilter,
  serviceCatalogFilter,
} from "~/server/services/catalog/marketplace";

// Rating is denormalized on Business (M3-W0), so the database orders by it
// directly; the take is only a safety bound over pathological catalogs.
const SUGGESTION_CANDIDATE_POOL = 100;

export type SuggestedService = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  businessName: string;
  ratingAvg: number | null;
  ratingCount: number;
};

export type SuggestedProduct = SuggestedService;

export type RequestSuggestions = {
  service: SuggestedService | null;
  product: SuggestedProduct | null;
};

const suggestionBusinessSelect = {
  select: { name: true, ratingAvg: true, ratingCount: true },
} as const;

const suggestionServiceSelect = {
  id: true,
  name: true,
  category: true,
  basePriceCents: true,
  business: suggestionBusinessSelect,
} satisfies Prisma.ServiceSelect;

type ServiceCandidate = Prisma.ServiceGetPayload<{
  select: typeof suggestionServiceSelect;
}>;

const suggestionProductSelect = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
  business: suggestionBusinessSelect,
} satisfies Prisma.ProductSelect;

type ProductCandidate = Prisma.ProductGetPayload<{
  select: typeof suggestionProductSelect;
}>;

type Candidate = SuggestedService;

type PriceRange = { minPriceCents: number; maxPriceCents: number };

const suggestionOrderBy = [
  { business: { ratingAvg: { sort: "desc", nulls: "last" } } },
  { createdAt: "desc" },
  { id: "desc" },
] satisfies
  | Prisma.ServiceOrderByWithRelationInput[]
  | Prisma.ProductOrderByWithRelationInput[];

function inRange(priceCents: number, range: PriceRange): boolean {
  return (
    priceCents >= range.minPriceCents && priceCents <= range.maxPriceCents
  );
}

/**
 * Picks the single best candidate: price inside the AI range wins first (when
 * any candidate is inside it), then the highest business rating, then the
 * most-reviewed business as tie-breaker.
 */
function pickBest(
  candidates: Candidate[],
  range: PriceRange,
): SuggestedService | null {
  const best = [...candidates].sort((a, b) => {
    const aInRange = inRange(a.priceCents, range) ? 1 : 0;
    const bInRange = inRange(b.priceCents, range) ? 1 : 0;

    if (aInRange !== bInRange) {
      return bInRange - aInRange;
    }

    return (
      (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) ||
      b.ratingCount - a.ratingCount
    );
  })[0];

  return best ?? null;
}

function serviceCandidate(row: ServiceCandidate): Candidate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.basePriceCents,
    businessName: row.business.name,
    ratingAvg: row.business.ratingAvg,
    ratingCount: row.business.ratingCount,
  };
}

function productCandidate(row: ProductCandidate): Candidate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.priceCents,
    businessName: row.business.name,
    ratingAvg: row.business.ratingAvg,
    ratingCount: row.business.ratingCount,
  };
}

/**
 * One suggested service and one suggested product for a freshly diagnosed
 * request. Cross-tenant read model: only ACTIVE businesses ever surface, the
 * best-rated candidate wins and the AI price range is honored when possible.
 * Products rarely share the service category (their taxonomy is finer, e.g.
 * "Grifería" under a "Plomería" repair), so the product lookup falls back to
 * the whole published catalog when the category has no direct match.
 */
export async function suggestForRequest(
  db: PrismaClient,
  input: { category: string } & PriceRange,
): Promise<RequestSuggestions> {
  const categoryFilter = {
    category: { equals: input.category, mode: "insensitive" },
  } satisfies Prisma.ServiceWhereInput;
  const [serviceRows, productRowsInCategory] = await Promise.all([
    db.service.findMany({
      where: { ...serviceCatalogFilter, ...categoryFilter },
      select: suggestionServiceSelect,
      orderBy: suggestionOrderBy,
      take: SUGGESTION_CANDIDATE_POOL,
    }),
    db.product.findMany({
      where: { ...productCatalogFilter, ...categoryFilter },
      select: suggestionProductSelect,
      orderBy: suggestionOrderBy,
      take: SUGGESTION_CANDIDATE_POOL,
    }),
  ]);
  const productRows =
    productRowsInCategory.length > 0
      ? productRowsInCategory
      : await db.product.findMany({
          where: productCatalogFilter,
          select: suggestionProductSelect,
          orderBy: suggestionOrderBy,
          take: SUGGESTION_CANDIDATE_POOL,
        });

  return {
    service: pickBest(serviceRows.map(serviceCandidate), input),
    product: pickBest(productRows.map(productCandidate), input),
  };
}
