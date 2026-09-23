import { overviewKpisSchema } from "~/app/[locale]/admin/_components/overview.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { OPEN_DISPUTE_STATUSES } from "~/server/services/admin/dispute-directory";
import {
  getAiConfigSummary,
  getOpenDisputes,
  getPendingBusinesses,
  getPlatformKpis,
} from "~/server/services/admin/platform-overview";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export const adminOverviewRouter = createTRPCRouter({
  /**
   * Lightweight counter consumed by the admin sidebar badge. Kept separate from
   * the W9 KPI query so the layout never pays for the full overview aggregate.
   */
  getSidebarStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const openDisputes = await ctx.db.dispute.count({
        where: { status: { in: [...OPEN_DISPUTE_STATUSES] } },
      });

      return ok({ openDisputes }, "Sidebar stats loaded");
    } catch (error) {
      return normalizedFailure(error, "Sidebar stats query failed");
    }
  }),

  getKpis: adminProcedure
    .input(overviewKpisSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getPlatformKpis(
          { db: ctx.db },
          input.month === undefined ? {} : { month: input.month },
        );

        if (!result.ok) {
          return fail(result.code, 409, "Platform KPIs unavailable");
        }

        return ok(result.data, "Platform KPIs loaded");
      } catch (error) {
        return normalizedFailure(error, "Platform KPIs query failed");
      }
    }),

  getPendingBusinesses: adminProcedure.query(async ({ ctx }) => {
    try {
      const result = await getPendingBusinesses({ db: ctx.db });

      if (!result.ok) {
        return fail(result.code, 409, "Pending businesses unavailable");
      }

      return ok(result.data, "Pending businesses loaded");
    } catch (error) {
      return normalizedFailure(error, "Pending businesses query failed");
    }
  }),

  getOpenDisputes: adminProcedure.query(async ({ ctx }) => {
    try {
      const result = await getOpenDisputes(
        { db: ctx.db },
        { statuses: OPEN_DISPUTE_STATUSES },
      );

      if (!result.ok) {
        return fail(result.code, 409, "Open disputes unavailable");
      }

      return ok(result.data, "Open disputes loaded");
    } catch (error) {
      return normalizedFailure(error, "Open disputes query failed");
    }
  }),

  getAiConfigSummary: adminProcedure.query(async ({ ctx }) => {
    try {
      const result = await getAiConfigSummary({ db: ctx.db });

      if (!result.ok) {
        return fail(result.code, 404, "Platform settings not found");
      }

      return ok(result.data, "AI configuration summary loaded");
    } catch (error) {
      return normalizedFailure(error, "AI configuration query failed");
    }
  }),
});
