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
  orderMarkDeliveredSchema,
  orderRedeemPickupSchema,
} from "~/server/services/orders/order.schema";
import {
  markDelivered,
  markOutForDelivery,
  markReadyForPickup,
  redeemPickup,
} from "~/server/services/orders/product-fulfillment";
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
  // F10 fulfillment (D10-2).
  FULFILLMENT_MISMATCH: 409,
  PICKUP_CODE_INVALID: 422,
  PICKUP_NOT_CONFIGURED: 503,
  TOO_MANY_REQUESTS: 429,
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

  /** D10-2 DELIVERY (optional step): the package left the branch. */
  markOutForDelivery: activeBusinessProcedure
    .input(orderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const marked = await markOutForDelivery(ctx.db, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          orderId: input.id,
        });

        if (!marked.ok) {
          return serviceFailure(marked.code, "Out for delivery failed");
        }

        return ok(marked.data, "Order out for delivery");
      } catch (error) {
        return orderFailure(error);
      }
    }),

  /**
   * D10-2 DELIVERY: delivered with ≥1 photo; requests the customer's
   * confirmation and arms the auto-release clock.
   */
  markDelivered: activeBusinessProcedure
    .input(orderMarkDeliveredSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const marked = await markDelivered(ctx.db, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          orderId: input.id,
          evidencePathnames: input.evidencePathnames,
          note: input.note,
        });

        if (!marked.ok) {
          return serviceFailure(marked.code, "Mark delivered failed");
        }

        return ok(marked.data, "Order delivered");
      } catch (error) {
        return orderFailure(error);
      }
    }),

  /** D10-2 PICKUP: the order waits at the branch with its pickup code. */
  markReadyForPickup: activeBusinessProcedure
    .input(orderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const marked = await markReadyForPickup(ctx.db, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          orderId: input.id,
        });

        if (!marked.ok) {
          return serviceFailure(marked.code, "Ready for pickup failed");
        }

        return ok(marked.data, "Order ready for pickup");
      } catch (error) {
        return orderFailure(error);
      }
    }),

  /**
   * D10-2 PICKUP: redeems the customer's QR code → PICKED_UP + CONFIRMED,
   * immediate escrow release and COMPLETED.
   */
  redeemPickup: activeBusinessProcedure
    .input(orderRedeemPickupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const redeemed = await redeemPickup(
          { db: ctx.db, resolveStripe: getStripe },
          {
            businessId: ctx.business.id,
            actorUserId: ctx.session.user.id,
            code: input.code,
          },
        );

        if (!redeemed.ok) {
          return serviceFailure(redeemed.code, "Pickup redemption failed");
        }

        return ok(redeemed.data, "Pickup redeemed");
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
