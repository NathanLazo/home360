import {
  getDisputeSchema,
  listDisputesSchema,
  resolveDisputeSchema,
} from "~/app/[locale]/admin/disputes/_components/disputes.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getDisputeById,
  listDisputes,
} from "~/server/services/admin/dispute-directory";
import { resolveDispute } from "~/server/services/disputes/resolve-dispute";
import { getStripe } from "~/server/services/stripe/client";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/** HTTP status per stable code; unknown codes fall back to 409. */
function statusForResolveError(code: string): number {
  if (code === "NOT_FOUND") {
    return 404;
  }

  if (code === "VALIDATION_ERROR" || code === "RECORDING_JUSTIFICATION_REQUIRED") {
    return 400;
  }

  if (code === "STRIPE_ERROR") {
    return 502;
  }

  return 409;
}

export const adminDisputesRouter = createTRPCRouter({
  list: adminProcedure
    .input(listDisputesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listDisputes({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Dispute list unavailable");
        }

        return ok(result.data, "Disputes loaded");
      } catch (error) {
        return normalizedFailure(error, "Dispute list query failed");
      }
    }),

  getById: adminProcedure
    .input(getDisputeSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getDisputeById({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 404, "Dispute not found");
        }

        return ok(result.data, "Dispute loaded");
      } catch (error) {
        return normalizedFailure(error, "Dispute query failed");
      }
    }),

  /**
   * Pure adapter: all money logic lives in `resolveDispute` (F5-07) and the
   * F3 escrow services it delegates to. Stable codes are propagated as-is and
   * never collapsed into a generic VALIDATION_ERROR.
   */
  resolve: adminProcedure
    .input(resolveDisputeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await resolveDispute(
          { db: ctx.db, stripe: getStripe() },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusForResolveError(result.code),
            "Dispute could not be resolved",
          );
        }

        return ok(result.data, "Dispute resolved");
      } catch (error) {
        return normalizedFailure(error, "Dispute resolution failed");
      }
    }),
});
