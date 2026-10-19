import { z } from "zod";

import { fail, normalizeError, type TrpcResponse } from "~/server/api/contract";
import {
  createTRPCRouter,
  publicProcedure,
  userProcedure,
} from "~/server/api/trpc";
import {
  getMarketplaceBusiness,
  getMarketplaceService,
  listMarketplaceBusinesses,
  resolveMarketplaceOrigin,
} from "~/server/services/catalog/business-directory";
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

/** Optional explicit origin; without both the default address is used. */
const originShape = {
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
};

const marketplaceProductSchema = z.object({
  id: z.string().cuid(),
  ...originShape,
});

const marketplaceServiceSchema = z.object({ id: z.string().cuid() });

const listBusinessesSchema = z
  .object({
    cursor: z.string().cuid().optional(),
    category: z.string().trim().min(1).max(60).optional(),
    kind: z.enum(MARKETPLACE_KINDS).optional(),
    ...originShape,
  })
  .optional();

const getBusinessSchema = z.object({
  id: z.string().cuid(),
  ...originShape,
});

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

  /** D10-6: availability per eligible branch + fulfillment options. */
  getProduct: userProcedure
    .input(marketplaceProductSchema)
    .query(async ({ ctx, input }) => {
      try {
        const origin = await resolveMarketplaceOrigin(ctx.db, {
          customerId: ctx.customer.id,
          lat: input.lat,
          lng: input.lng,
        });

        return await getMarketplaceProduct(ctx.db, input.id, origin);
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),

  /** D10-10: ACTIVE businesses, nearest first (explicit point or default address). */
  listBusinesses: userProcedure
    .input(listBusinessesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const origin = await resolveMarketplaceOrigin(ctx.db, {
          customerId: ctx.customer.id,
          lat: input?.lat,
          lng: input?.lng,
        });

        return await listMarketplaceBusinesses(ctx.db, {
          cursor: input?.cursor,
          category: input?.category,
          kind: input?.kind,
          origin,
        });
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),

  /** D10-10: public business profile with services, products and branches. */
  getBusiness: userProcedure
    .input(getBusinessSchema)
    .query(async ({ ctx, input }) => {
      try {
        const origin = await resolveMarketplaceOrigin(ctx.db, {
          customerId: ctx.customer.id,
          lat: input.lat,
          lng: input.lng,
        });

        return await getMarketplaceBusiness(ctx.db, { id: input.id, origin });
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),

  /** D10-10: service detail (the search returns services the app can open). */
  getService: userProcedure
    .input(marketplaceServiceSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getMarketplaceService(ctx.db, input.id);
      } catch (error) {
        return marketplaceFailure(error);
      }
    }),
});
