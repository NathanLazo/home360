import "server-only";

import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import {
  getBusinessRatings,
  productCatalogFilter,
  serviceCatalogFilter,
  type BusinessRating,
} from "~/server/services/catalog/marketplace";

// Rating is aggregated in memory (it is not a column), so candidates are
// bounded the same way the featured ranking of M2-W1 bounds its pool.
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

const suggestionServiceSelect = {
  id: true,
  name: true,
  category: true,
  basePriceCents: true,
  business: { select: { id: true, name: true } },
} satisfies Prisma.ServiceSelect;

type ServiceCandidate = Prisma.ServiceGetPayload<{
  select: typeof suggestionServiceSelect;
}>;

const suggestionProductSelect = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
  business: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

type ProductCandidate = Prisma.ProductGetPayload<{
  select: typeof suggestionProductSelect;
}>;

type Candidate = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  businessId: string;
  businessName: string;
};

type PriceRange = { minPriceCents: number; maxPriceCents: number };

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
  ratings: Map<string, BusinessRating>,
): SuggestedService | null {
  const scoreOf = (candidate: Candidate): BusinessRating =>
    ratings.get(candidate.businessId) ?? { ratingAvg: null, ratingCount: 0 };
  const best = [...candidates].sort((a, b) => {
    const aInRange = inRange(a.priceCents, range) ? 1 : 0;
    const bInRange = inRange(b.priceCents, range) ? 1 : 0;

    if (aInRange !== bInRange) {
      return bInRange - aInRange;
    }

    const aRating = scoreOf(a);
    const bRating = scoreOf(b);

    return (
      (bRating.ratingAvg ?? -1) - (aRating.ratingAvg ?? -1) ||
      bRating.ratingCount - aRating.ratingCount
    );
  })[0];

  if (!best) {
    return null;
  }

  const rating = scoreOf(best);

  return {
    id: best.id,
    name: best.name,
    category: best.category,
    priceCents: best.priceCents,
    businessName: best.businessName,
    ratingAvg: rating.ratingAvg,
    ratingCount: rating.ratingCount,
  };
}

function serviceCandidate(row: ServiceCandidate): Candidate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.basePriceCents,
    businessId: row.business.id,
    businessName: row.business.name,
  };
}

function productCandidate(row: ProductCandidate): Candidate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.priceCents,
    businessId: row.business.id,
    businessName: row.business.name,
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUGGESTION_CANDIDATE_POOL,
    }),
    db.product.findMany({
      where: { ...productCatalogFilter, ...categoryFilter },
      select: suggestionProductSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUGGESTION_CANDIDATE_POOL,
    }),
  ]);
  const productRows =
    productRowsInCategory.length > 0
      ? productRowsInCategory
      : await db.product.findMany({
          where: productCatalogFilter,
          select: suggestionProductSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: SUGGESTION_CANDIDATE_POOL,
        });
  const services = serviceRows.map(serviceCandidate);
  const products = productRows.map(productCandidate);
  const ratings = await getBusinessRatings(db, [
    ...new Set(
      [...services, ...products].map((candidate) => candidate.businessId),
    ),
  ]);

  return {
    service: pickBest(services, input, ratings),
    product: pickBest(products, input, ratings),
  };
}
