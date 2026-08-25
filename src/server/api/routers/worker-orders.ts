import { z } from "zod";

import {
  OrderEventType,
  WorkerAvailability,
} from "../../../../generated/prisma";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, workerProcedure } from "~/server/api/trpc";
import {
  finishAssignedOrder,
  getAssignedOrderById,
  listAssignedOrders,
  setWorkerAvailability,
  startOrderRecording,
  stopOrderRecording,
  transitionAssignedOrder,
} from "~/server/services/orders/worker-flow";

const orderIdSchema = z.object({ orderId: z.string().cuid() });

const transitionSchema = orderIdSchema.extend({
  to: z.enum([OrderEventType.EN_ROUTE, OrderEventType.ARRIVED]),
});

const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const startRecordingSchema = orderIdSchema.extend({
  startLat: geoSchema.shape.lat,
  startLng: geoSchema.shape.lng,
});

const stopRecordingSchema = z
  .object({
    segmentId: z.string().cuid(),
    pathname: z.string().trim().min(1).max(500).optional(),
    interrupted: z.boolean().default(false),
    endLat: geoSchema.shape.lat,
    endLng: geoSchema.shape.lng,
  })
  .refine((input) => input.interrupted || input.pathname !== undefined, {
    message: "pathname is required unless the recording was interrupted",
    path: ["pathname"],
  });

const materialSchema = z.object({
  productId: z.string().cuid().optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(10_000),
  unitPriceCents: z.number().int().nonnegative().max(2_147_483_647),
});

const finishSchema = orderIdSchema.extend({
  beforePathnames: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  afterPathnames: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  workNotes: z.string().trim().min(1).max(5_000),
  materials: z.array(materialSchema).max(100),
});

const setAvailabilitySchema = z.object({
  availability: z.nativeEnum(WorkerAvailability),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RECORDING_JUSTIFICATION_REQUIRED: 422,
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

/** Worker-only service order lifecycle. Every resource is scoped by ctx.worker. */
export const workerOrdersRouter = createTRPCRouter({
  listAssigned: workerProcedure.query(async ({ ctx }) => {
    try {
      const assigned = await listAssignedOrders(ctx.db, ctx.worker.id);

      if (!assigned.ok) {
        return serviceFailure(assigned.code, "Assigned orders could not load");
      }

      return ok(assigned.data, "Assigned orders loaded");
    } catch (error) {
      return unexpectedFailure(error, "Assigned orders could not load");
    }
  }),

  getById: workerProcedure
    .input(orderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const order = await getAssignedOrderById(ctx.db, {
          workerId: ctx.worker.id,
          userId: ctx.session.user.id,
          orderId: input.orderId,
        });

        if (!order.ok) {
          return serviceFailure(order.code, "Order not found");
        }

        return ok(order.data, "Assigned order loaded");
      } catch (error) {
        return unexpectedFailure(error, "Assigned order could not load");
      }
    }),

  transition: workerProcedure
    .input(transitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const transitioned = await transitionAssignedOrder(ctx.db, {
          workerId: ctx.worker.id,
          actorUserId: ctx.session.user.id,
          orderId: input.orderId,
          to: input.to,
        });

        if (!transitioned.ok) {
          return serviceFailure(
            transitioned.code,
            "Order transition could not be applied",
          );
        }

        return ok(transitioned.data, "Order transitioned");
      } catch (error) {
        return unexpectedFailure(error, "Order transition failed");
      }
    }),

  startRecording: workerProcedure
    .input(startRecordingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const started = await startOrderRecording(ctx.db, {
          workerId: ctx.worker.id,
          actorUserId: ctx.session.user.id,
          orderId: input.orderId,
          startLat: input.startLat,
          startLng: input.startLng,
        });

        if (!started.ok) {
          return serviceFailure(started.code, "Recording could not start");
        }

        return ok(started.data, "Recording started", 201);
      } catch (error) {
        return unexpectedFailure(error, "Recording could not start");
      }
    }),

  stopRecording: workerProcedure
    .input(stopRecordingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const stopped = await stopOrderRecording(ctx.db, {
          workerId: ctx.worker.id,
          actorUserId: ctx.session.user.id,
          segmentId: input.segmentId,
          pathname: input.pathname,
          interrupted: input.interrupted,
          endLat: input.endLat,
          endLng: input.endLng,
        });

        if (!stopped.ok) {
          return serviceFailure(stopped.code, "Recording could not stop");
        }

        return ok(stopped.data, "Recording stopped");
      } catch (error) {
        return unexpectedFailure(error, "Recording could not stop");
      }
    }),

  finish: workerProcedure
    .input(finishSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const finished = await finishAssignedOrder(ctx.db, {
          workerId: ctx.worker.id,
          actorUserId: ctx.session.user.id,
          orderId: input.orderId,
          beforePathnames: input.beforePathnames,
          afterPathnames: input.afterPathnames,
          workNotes: input.workNotes,
          materials: input.materials,
        });

        if (!finished.ok) {
          return serviceFailure(finished.code, "Order could not be finished");
        }

        return ok(finished.data, "Confirmation requested");
      } catch (error) {
        return unexpectedFailure(error, "Order could not be finished");
      }
    }),

  setAvailability: workerProcedure
    .input(setAvailabilitySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await setWorkerAvailability(ctx.db, {
          workerId: ctx.worker.id,
          availability: input.availability,
        });

        if (!updated.ok) {
          return serviceFailure(updated.code, "Availability could not update");
        }

        return ok(updated.data, "Availability updated");
      } catch (error) {
        return unexpectedFailure(error, "Availability could not update");
      }
    }),
});
