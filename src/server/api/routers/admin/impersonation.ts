import { fail, normalizeError, ok } from "~/server/api/contract";
import {
  adminProcedure,
  authenticatedProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  startImpersonation,
  stopImpersonation,
} from "~/server/services/admin/impersonation";
import { startImpersonationSchema } from "~/schemas/admin/impersonation.schema";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export const adminImpersonationRouter = createTRPCRouter({
  start: adminProcedure
    .input(startImpersonationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await startImpersonation(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Impersonation could not start",
          );
        }

        return ok(result.data, "Impersonation started");
      } catch (error) {
        return normalizedFailure(error, "Impersonation start failed");
      }
    }),

  /**
   * Called from inside the impersonated panel, where the effective role is
   * BUSINESS/CORPORATE: `adminProcedure` would refuse it and
   * `protectedProcedure` blocks every mutation while impersonating. Access is
   * the impersonator itself, resolved server-side from the `Session` row.
   */
  stop: authenticatedProcedure.mutation(async ({ ctx }) => {
    const impersonator = ctx.session.user.impersonator;

    if (impersonator === null) {
      return fail("CONFLICT", 409, "No active impersonation");
    }

    try {
      const result = await stopImpersonation(
        { db: ctx.db },
        { adminId: impersonator.id },
      );

      if (!result.ok) {
        return fail(result.code, 409, "Impersonation could not stop");
      }

      return ok(result.data, "Impersonation stopped");
    } catch (error) {
      return normalizedFailure(error, "Impersonation stop failed");
    }
  }),
});
