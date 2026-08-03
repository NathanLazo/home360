import { z } from "zod";

import { fail, normalizeError, ok } from "~/server/api/contract";
import { businessProcedure, createTRPCRouter } from "~/server/api/trpc";
import { assertBranchInBusiness } from "~/server/services/business/branch-access";
import {
  getBusinessKpis,
  getOrdersByBranch,
  getRecentOrders,
  getWeeklyRevenue,
} from "~/server/services/dashboard/business-kpis";

const branchScopedSchema = z.object({
  branchId: z.string().cuid().optional(),
});

const getKpisSchema = branchScopedSchema.extend({
  days: z.number().int().min(1).max(365).default(30),
});

const getWeeklyRevenueSchema = branchScopedSchema.extend({
  weeks: z.number().int().min(1).max(26).default(8),
});

const getOrdersByBranchSchema = branchScopedSchema.extend({
  days: z.number().int().min(1).max(365).default(30),
});

const getRecentOrdersSchema = branchScopedSchema.extend({
  limit: z.number().int().min(1).max(20).default(5),
});

async function branchBelongsToBusiness(
  db: Parameters<typeof assertBranchInBusiness>[0],
  businessId: string,
  branchId?: string,
): Promise<boolean> {
  return branchId ? assertBranchInBusiness(db, businessId, branchId) : true;
}

function normalizedFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Dashboard query failed");
}

export const dashboardRouter = createTRPCRouter({
  getKpis: businessProcedure
    .input(getKpisSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (
          !(await branchBelongsToBusiness(
            ctx.db,
            ctx.business.id,
            input.branchId,
          ))
        ) {
          return fail("NOT_FOUND", 404, "Branch not found");
        }

        const result = await getBusinessKpis(ctx.db, ctx.business.id, input);
        return ok(result, "Business KPIs loaded");
      } catch (error) {
        return normalizedFailure(error);
      }
    }),

  getWeeklyRevenue: businessProcedure
    .input(getWeeklyRevenueSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (
          !(await branchBelongsToBusiness(
            ctx.db,
            ctx.business.id,
            input.branchId,
          ))
        ) {
          return fail("NOT_FOUND", 404, "Branch not found");
        }

        const result = await getWeeklyRevenue(ctx.db, ctx.business.id, input);
        return ok(result, "Weekly revenue loaded");
      } catch (error) {
        return normalizedFailure(error);
      }
    }),

  getOrdersByBranch: businessProcedure
    .input(getOrdersByBranchSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (
          !(await branchBelongsToBusiness(
            ctx.db,
            ctx.business.id,
            input.branchId,
          ))
        ) {
          return fail("NOT_FOUND", 404, "Branch not found");
        }

        const result = await getOrdersByBranch(ctx.db, ctx.business.id, input);
        return ok(result, "Orders by branch loaded");
      } catch (error) {
        return normalizedFailure(error);
      }
    }),

  getRecentOrders: businessProcedure
    .input(getRecentOrdersSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (
          !(await branchBelongsToBusiness(
            ctx.db,
            ctx.business.id,
            input.branchId,
          ))
        ) {
          return fail("NOT_FOUND", 404, "Branch not found");
        }

        const result = await getRecentOrders(ctx.db, ctx.business.id, input);
        return ok(result, "Recent orders loaded");
      } catch (error) {
        return normalizedFailure(error);
      }
    }),
});
