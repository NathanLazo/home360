import {
  listReportsSchema,
  resolveReportSchema,
} from "~/app/[locale]/admin/reports/_components/reports.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  listContentReports,
  resolveContentReport,
} from "~/server/services/moderation/admin-reports";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

const resolveStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

/** W14: chat content reports from the mobile app (App Store 1.2). */
export const adminReportsRouter = createTRPCRouter({
  list: adminProcedure
    .input(listReportsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listContentReports(ctx.db, input);

        if (!result.ok) {
          return fail(result.code, 404, "Report list unavailable");
        }

        return ok(result.data, "Reports loaded");
      } catch (error) {
        return normalizedFailure(error, "Report list query failed");
      }
    }),

  resolve: adminProcedure
    .input(resolveReportSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await resolveContentReport(ctx.db, {
          ...input,
          adminId: ctx.session.user.id,
        });

        if (!result.ok) {
          return fail(
            result.code,
            resolveStatuses[result.code],
            "Report could not be resolved",
          );
        }

        return ok(result.data, "Report resolved");
      } catch (error) {
        return normalizedFailure(error, "Report resolve failed");
      }
    }),
});
