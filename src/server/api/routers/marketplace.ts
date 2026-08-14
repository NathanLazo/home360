import { z } from "zod";

import { fail, normalizeError, type TrpcResponse } from "~/server/api/contract";
import {
  createTRPCRouter,
  publicProcedure,
  userProcedure,
} from "~/server/api/trpc";
import {
  MARKETPLACE_KINDS,
  getMarketplaceProduct,
  listFeaturedProducts,
  listMarketplaceCategories,
  searchMarketplace,
} from "~/server/services/catalog/marketplace";

const marketplaceSearchSchema = z.object({
  query: z.string().trim().min(1).max(100),
  kind: z.enum(MARKETPLACE_KINDS).optional(),
  // Compound cursor: `<kind>:<id>`; the service validates shape and ownership.
  cursor: z.string().min(3).max(80).optional(),
});

const marketplaceProductSchema = z.object({ id: z.string().cuid() });

function marketplaceFailure(error: unknown): TrpcResponse<never> {
  const normalized = normalizeError(error);

  return fail(
    normalized.code,
    normalized.status,
    "Marketplace operation failed",
  );
}

/**
 * Customer-facing marketplace catalog (M2-W1). Read-only and cross-tenant:
 * every query is limited to ACTIVE businesses by the service layer.
 */
export const marketplaceRouter = createTRPCRouter({
  listCategories: publicProcedure.query(async ({ ctx }) => {
    try {
      return await listMarketplaceCategories(ctx.db);
    } catch (error) {
      return marketplaceFailure(error);
    }
  }),

  listFeaturedProducts: userProcedure.query(async ({ ctx }) => {
    try {
      return await listFeaturedProducts(ctx.db);
    } catch (error) {
      return marketplaceFailure(error);
    }
  }),

  search: userProcedure
    .input(marketplaceSearchSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await searchMarketplace(ctx.db, input);
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),

  getProduct: userProcedure
    .input(marketplaceProductSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getMarketplaceProduct(ctx.db, input.id);
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),
});
