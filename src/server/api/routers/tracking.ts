import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { consumerProcedure } from "~/server/api/consumer-procedure";
import { createTRPCRouter, workerProcedure } from "~/server/api/trpc";
import { cancelUnpaidOrder } from "~/server/services/orders/cancel-unpaid-order";
import { requestOrderRework } from "~/server/services/orders/request-rework";
import {
  getCustomerOrderView,
  listMyOrders,
  updateWorkerLocation,
} from "~/server/services/orders/tracking";
import { getStripe } from "~/server/services/stripe/client";

const getOrderSchema = z.object({ orderId: z.string().cuid() });

const listMyOrdersSchema = z
  .object({ cursor: z.string().cuid().optional() })
  .optional();

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const requestReworkSchema = z.object({
  orderId: z.string().cuid(),
  note: z.string().trim().min(10).max(1_000),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * C6 order tracking (M4-W2 + workstream D): the consumer follows the state
 * machine, the evidence and the technician's live position; the worker
 * publishes it while en route. A foreign order answers a generic NOT_FOUND;
 * coordinates are only exposed inside the live-tracking window.
 */
export const trackingRouter = createTRPCRouter({
  getOrder: consumerProcedure
    .input(getOrderSchema)
    .query(async ({ ctx, input }) => {
      try {
        const view = await getCustomerOrderView(ctx.db, {
          customerId: ctx.consumer.userId,
          orderId: input.orderId,
        });

        if (!view.ok) {
          return serviceFailure(view.code, "Order not found");
        }

        return ok(view.data, "Order tracking loaded");
      } catch (error) {
        return unexpectedFailure(error, "Order tracking failed");
      }
    }),

  listMyOrders: consumerProcedure
    .input(listMyOrdersSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMyOrders(ctx.db, {
          customerId: ctx.consumer.userId,
          cursor: input?.cursor,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Order list failed");
        }

        return ok(list.data, "Orders loaded");
      } catch (error) {
        return unexpectedFailure(error, "Order list failed");
      }
    }),

  /** Cancels an own order that was never paid and reopens its request. */
  cancelOrder: consumerProcedure
    .input(getOrderSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const cancelled = await cancelUnpaidOrder(
          { db: ctx.db, stripe: getStripe() },
          { customerId: ctx.consumer.userId, orderId: input.orderId },
        );

        if (!cancelled.ok) {
          return serviceFailure(cancelled.code, "Order cancel failed");
        }

        return ok(cancelled.data, "Order cancelled");
      } catch (error) {
        return unexpectedFailure(error, "Order cancel failed");
      }
    }),

  /** Sends a finished SERVICE order back to the technician for a fix. */
  requestRework: consumerProcedure
    .input(requestReworkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const reworked = await requestOrderRework(ctx.db, {
          customerId: ctx.consumer.userId,
          orderId: input.orderId,
          note: input.note,
        });

        if (!reworked.ok) {
          return serviceFailure(reworked.code, "Rework request failed");
        }

        return ok(reworked.data, "Rework requested");
      } catch (error) {
        return unexpectedFailure(error, "Rework request failed");
      }
    }),

  updateLocation: workerProcedure
    .input(updateLocationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateWorkerLocation(ctx.db, {
          workerId: ctx.worker.id,
          latitude: input.lat,
          longitude: input.lng,
        });

        if (!updated.ok) {
          return serviceFailure(updated.code, "Location update failed");
        }

        return ok(updated.data, "Location updated");
      } catch (error) {
        return unexpectedFailure(error, "Location update failed");
      }
    }),
});
