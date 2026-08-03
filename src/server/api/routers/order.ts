import { fail, normalizeError } from "~/server/api/contract";
import { businessProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getOrderById,
  listOrders,
} from "~/server/services/orders/order-directory";
import {
  orderIdSchema,
  orderListSchema,
} from "~/server/services/orders/order.schema";

function orderFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Order operation failed");
}

export const orderRouter = createTRPCRouter({
  list: businessProcedure
    .input(orderListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listOrders(ctx.db, ctx.business.id, input);
      } catch (error) {
        return orderFailure(error);
      }
    }),

  getById: businessProcedure
    .input(orderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getOrderById(ctx.db, ctx.business.id, input.id);
      } catch (error) {
        return orderFailure(error);
      }
    }),
});
