import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  adminOrderIdSchema,
  adminOrderListSchema,
} from "~/server/services/admin/admin-order.schema";
import {
  getAdminOrder,
  listAdminOrders,
} from "~/server/services/admin/order-directory";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/** D10-14: platform-wide order supervision (read-only). */
export const adminOrdersRouter = createTRPCRouter({
  list: adminProcedure
    .input(adminOrderListSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listAdminOrders(ctx.db, input ?? {});

        if (!result.ok) {
          return fail(result.code, 404, "Order list unavailable");
        }

        return ok(result.data, "Orders loaded");
      } catch (error) {
        return normalizedFailure(error, "Order list query failed");
      }
    }),

  getById: adminProcedure
    .input(adminOrderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getAdminOrder(ctx.db, {
          adminUserId: ctx.session.user.id,
          id: input.id,
        });

        if (!result.ok) {
          return fail(result.code, 404, "Order not found");
        }

        return ok(result.data, "Order loaded");
      } catch (error) {
        return normalizedFailure(error, "Order query failed");
      }
    }),
});
