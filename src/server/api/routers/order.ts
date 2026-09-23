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
import { assignOrderWorker } from "~/server/services/orders/assign-worker";
import { cancelOrder } from "~/server/services/orders/cancel-order";
import {
  getOrderById,
  listOrders,
} from "~/server/services/orders/order-directory";
import {
  orderAssignWorkerSchema,
  orderCancelSchema,
  orderIdSchema,
  orderListSchema,
} from "~/server/services/orders/order.schema";
import { getStripe } from "~/server/services/stripe/client";

function orderFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Order operation failed");
}

/** HTTP status per service code surfaced by the order lifecycle services. */
const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  PAYMENT_NOT_REFUNDABLE: 409,
  REFUND_EXCEEDS_LIMIT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
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
        return await getOrderById(ctx.db, {
          businessId: ctx.business.id,
          userId: ctx.session.user.id,
          id: input.id,
        });
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
          return serviceFailure(accepted.code, "Accept product failed");
        }

        return ok(accepted.data, "Product order accepted");
      } catch (error) {
        return orderFailure(error);
      }
    }),

  /**
   * Cancels an order that has not started: unpaid → CANCELLED, paid (escrow
   * held) → CANCELLED + full refund. Later states answer CONFLICT.
   */
  cancel: activeBusinessProcedure
    .input(orderCancelSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const cancelled = await cancelOrder(
          { db: ctx.db, resolveStripe: getStripe },
          {
            businessId: ctx.business.id,
            actorUserId: ctx.session.user.id,
            orderId: input.id,
            reason: input.reason,
          },
        );

        if (!cancelled.ok) {
          return serviceFailure(cancelled.code, "Order cancel failed");
        }

        return ok(cancelled.data, "Order cancelled");
      } catch (error) {
        return orderFailure(error);
      }
    }),

  /** Assigns or reassigns the technician of an unfinished SERVICE order. */
  assignWorker: activeBusinessProcedure
    .input(orderAssignWorkerSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const assigned = await assignOrderWorker(ctx.db, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          orderId: input.orderId,
          workerId: input.workerId,
        });

        if (!assigned.ok) {
          return serviceFailure(assigned.code, "Worker assignment failed");
        }

        return ok(assigned.data, "Worker assigned");
      } catch (error) {
        return orderFailure(error);
      }
    }),
});
