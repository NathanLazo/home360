import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import {
  cancelMyRequest,
  createServiceRequest,
  getMyRequest,
  listMyRequests,
} from "~/server/services/marketplace/request";

const MAX_MEDIA_PER_REQUEST = 5;

const createRequestSchema = z.object({
  // Blob pathnames issued by media.createUploadToken (M0-W3); ownership and
  // kind are enforced by the service against the session user.
  mediaPathnames: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(MAX_MEDIA_PER_REQUEST),
  description: z.string().trim().max(1_000).optional(),
  addressId: z.string().cuid(),
});

const requestIdSchema = z.object({ id: z.string().cuid() });

const listMineSchema = z
  .object({ cursor: z.string().cuid().optional() })
  .optional();

/**
 * HTTP status per service code. `AI_UNAVAILABLE` is a 503: the request is
 * valid, the diagnosis backend is not reachable right now.
 */
const serviceErrorStatuses = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
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
 * Customer service requests (M2-W2): media uploaded in C2 is diagnosed by the
 * AI service and persisted as an OPEN request the app renders in C3. Tenant
 * always comes from the session; a foreign request answers a generic
 * NOT_FOUND.
 */
export const requestRouter = createTRPCRouter({
  create: userProcedure
    .input(createRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await createServiceRequest(ctx.db, {
          customerId: ctx.customer.id,
          mediaPathnames: input.mediaPathnames,
          description: input.description,
          addressId: input.addressId,
        });

        if (!created.ok) {
          return serviceFailure(created.code, "Request creation failed");
        }

        return ok(created.data, "Request created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Request creation failed");
      }
    }),

  getById: userProcedure
    .input(requestIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const request = await getMyRequest(ctx.db, {
          customerId: ctx.customer.id,
          id: input.id,
        });

        if (!request.ok) {
          return serviceFailure(request.code, "Request not found");
        }

        return ok(request.data, "Request loaded");
      } catch (error) {
        return unexpectedFailure(error, "Request load failed");
      }
    }),

  listMine: userProcedure
    .input(listMineSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMyRequests(ctx.db, {
          customerId: ctx.customer.id,
          cursor: input?.cursor,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Request list failed");
        }

        return ok(list.data, "Requests loaded");
      } catch (error) {
        return unexpectedFailure(error, "Request list failed");
      }
    }),

  cancel: userProcedure
    .input(requestIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const cancelled = await cancelMyRequest(ctx.db, {
          customerId: ctx.customer.id,
          id: input.id,
        });

        if (!cancelled.ok) {
          return serviceFailure(cancelled.code, "Request cancel failed");
        }

        return ok(cancelled.data, "Request cancelled");
      } catch (error) {
        return unexpectedFailure(error, "Request cancel failed");
      }
    }),
});
