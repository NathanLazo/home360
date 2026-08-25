import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  createTRPCRouter,
  userProcedure,
  workerProcedure,
} from "~/server/api/trpc";
import {
  getOrderTracking,
  listMyOrders,
  updateWorkerLocation,
} from "~/server/services/orders/tracking";

const getOrderSchema = z.object({ orderId: z.string().cuid() });

const listMyOrdersSchema = z
  .object({ cursor: z.string().cuid().optional() })
  .optional();

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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
 * C6 order tracking (M4-W2): the customer follows the state machine and the
 * technician's live position; the worker publishes it while en route. A
 * foreign order answers a generic NOT_FOUND; coordinates are only exposed
 * inside the live-tracking window (see the tracking service).
 */
export const trackingRouter = createTRPCRouter({
  getOrder: userProcedure
    .input(getOrderSchema)
    .query(async ({ ctx, input }) => {
      try {
        const tracking = await getOrderTracking(ctx.db, {
          customerId: ctx.customer.id,
          orderId: input.orderId,
        });

        if (!tracking.ok) {
          return serviceFailure(tracking.code, "Order not found");
        }

        return ok(tracking.data, "Order tracking loaded");
      } catch (error) {
        return unexpectedFailure(error, "Order tracking failed");
      }
    }),

  listMyOrders: userProcedure
    .input(listMyOrdersSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMyOrders(ctx.db, {
          customerId: ctx.customer.id,
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
