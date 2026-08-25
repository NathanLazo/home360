import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import { acceptProductOrder } from "~/server/services/orders/accept-product";
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

const acceptProductErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type AcceptProductErrorCode = keyof typeof acceptProductErrorStatuses;

function acceptProductFailure(
  code: AcceptProductErrorCode,
  message: string,
): TrpcResponse<never, AcceptProductErrorCode> {
  return fail(code, acceptProductErrorStatuses[code], message);
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

  acceptProduct: activeBusinessProcedure
    .input(orderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const accepted = await acceptProductOrder(ctx.db, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          orderId: input.id,
        });

        if (!accepted.ok) {
          return acceptProductFailure(accepted.code, "Accept product failed");
        }

        return ok(accepted.data, "Product order accepted");
      } catch (error) {
        return orderFailure(error);
      }
    }),
});
