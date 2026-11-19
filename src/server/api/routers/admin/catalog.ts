import {
  listPlatformProductsSchema,
  listPlatformServicesSchema,
} from "~/schemas/admin/platform-catalog.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  listPlatformProducts,
  listPlatformServices,
} from "~/server/services/admin/platform-catalog";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/** Cross-business catalog, read-only: products and services of every business. */
export const adminCatalogRouter = createTRPCRouter({
  listProducts: adminProcedure
    .input(listPlatformProductsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listPlatformProducts({ db: ctx.db }, input);
        return ok(result, "Products loaded");
      } catch (error) {
        return normalizedFailure(error, "Product list query failed");
      }
    }),

  listServices: adminProcedure
    .input(listPlatformServicesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listPlatformServices({ db: ctx.db }, input);
        return ok(result, "Services loaded");
      } catch (error) {
        return normalizedFailure(error, "Service list query failed");
      }
    }),
});
