import { fail, normalizeError } from "~/server/api/contract";
import {
  corporateInvoiceListSchema,
  corporateLocationCreateSchema,
  corporateLocationIdSchema,
  corporateLocationListSchema,
  corporateLocationUpdateSchema,
  corporateOrderListSchema,
  corporateOverviewSchema,
  corporateTierChangeRequestSchema,
} from "~/server/api/schemas/corporate";
import {
  activeCorporateProcedure,
  corporateProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  createCorporateLocation,
  deactivateCorporateLocation,
  listCorporateLocations,
  updateCorporateLocation,
} from "~/server/services/corporate/corporate-locations";
import {
  getCorporateMembership,
  listCorporateInvoices,
} from "~/server/services/corporate/corporate-membership";
import {
  getCorporateOverview,
  listCorporateOrders,
} from "~/server/services/corporate/corporate-spending";
import { requestCorporateTierChange } from "~/server/services/corporate/corporate-tier-requests";

function corporateFailure(error: unknown) {
  const normalized = normalizeError(error);

  return fail(
    normalized.code,
    normalized.status,
    "Corporate operation failed",
  );
}

/**
 * Dashboard surface of the corporate customer (F7-05). Every query filters by
 * `ctx.corporateAccount.id` inside the Prisma query — the tenant comes from
 * the session, never from input. Reads run under `corporateProcedure` so a
 * suspended account still sees its own state; mutations require
 * `activeCorporateProcedure`.
 */
export const corporateRouter = createTRPCRouter({
  getOverview: corporateProcedure
    .input(corporateOverviewSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getCorporateOverview(ctx.db, ctx.corporateAccount.id, {
          month: input.month,
        });
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  listOrders: corporateProcedure
    .input(corporateOrderListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listCorporateOrders(
          ctx.db,
          ctx.corporateAccount.id,
          input,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  listLocations: corporateProcedure
    .input(corporateLocationListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listCorporateLocations(ctx.db, ctx.corporateAccount, input);
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  createLocation: activeCorporateProcedure
    .input(corporateLocationCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCorporateLocation(
          ctx.db,
          ctx.corporateAccount,
          input,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  updateLocation: activeCorporateProcedure
    .input(corporateLocationUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateCorporateLocation(
          ctx.db,
          ctx.corporateAccount.id,
          input,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  deactivateLocation: activeCorporateProcedure
    .input(corporateLocationIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deactivateCorporateLocation(
          ctx.db,
          ctx.corporateAccount.id,
          input.locationId,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  getMembership: corporateProcedure.query(async ({ ctx }) => {
    try {
      return await getCorporateMembership(ctx.db, ctx.corporateAccount.id);
    } catch (error) {
      return corporateFailure(error);
    }
  }),

  listInvoices: corporateProcedure
    .input(corporateInvoiceListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listCorporateInvoices(
          ctx.db,
          ctx.corporateAccount.id,
          input,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  requestTierChange: activeCorporateProcedure
    .input(corporateTierChangeRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await requestCorporateTierChange(
          ctx.db,
          ctx.corporateAccount.id,
          input,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),
});
