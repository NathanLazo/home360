import { changePasswordSchema } from "~/schemas/settings/business-settings.schema";
import { fail, normalizeError } from "~/server/api/contract";
import { corporateConsumerProcedures } from "~/server/api/routers/corporate-consumer";
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
  reactivateCorporateLocation,
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
import { getCorporateSettings } from "~/server/services/corporate/corporate-settings";
import {
  cancelCorporateTierChangeRequest,
  requestCorporateTierChange,
} from "~/server/services/corporate/corporate-tier-requests";
import { changePassword } from "~/server/services/settings/business-settings";

function corporateFailure(error: unknown) {
  const normalized = normalizeError(error);

  return fail(normalized.code, normalized.status, "Corporate operation failed");
}

/**
 * Dashboard surface of the corporate customer (F7-05). Every query filters by
 * `ctx.corporateAccount.id` inside the Prisma query — the tenant comes from
 * the session, never from input. Reads run under `corporateProcedure` so a
 * suspended account still sees its own state; mutations require
 * `activeCorporateProcedure`.
 */
export const corporateRouter = createTRPCRouter({
  ...corporateConsumerProcedures,

  /**
   * Reactivates a location (workstream D) under the same tier limit as
   * creation: `PLAN_LIMIT_REACHED` when every paid slot is taken.
   */
  reactivateLocation: activeCorporateProcedure
    .input(corporateLocationIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await reactivateCorporateLocation(
          ctx.db,
          ctx.corporateAccount,
          input.locationId,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  /** Withdraws the account's own pending tier-change request. */
  cancelTierChangeRequest: activeCorporateProcedure.mutation(
    async ({ ctx }) => {
      try {
        return await cancelCorporateTierChangeRequest(
          ctx.db,
          ctx.corporateAccount.id,
        );
      } catch (error) {
        return corporateFailure(error);
      }
    },
  ),

  /** `/corporate/settings`: company data (read-only) and owner profile. */
  getSettings: corporateProcedure.query(async ({ ctx }) => {
    try {
      return await getCorporateSettings(ctx.db, ctx.corporateAccount.id);
    } catch (error) {
      return corporateFailure(error);
    }
  }),

  /**
   * Owner password change, reusing the shared settings service: it verifies
   * the current password and revokes every live session.
   */
  changePassword: corporateProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await changePassword(ctx.db, ctx.session.user.id, input);
      } catch (error) {
        return corporateFailure(error);
      }
    }),

  getOverview: corporateProcedure
    .input(corporateOverviewSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getCorporateOverview(ctx.db, ctx.corporateAccount.id, {
          month: input.month,
          locationId: input.locationId,
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
        return await listCorporateLocations(
          ctx.db,
          ctx.corporateAccount,
          input,
        );
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
