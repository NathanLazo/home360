import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  activeBusinessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  getRadarRequest,
  listOpenRequests,
} from "~/server/services/orders/radar";

const listOpenRequestsSchema = z.object({
  branchId: z.string().cuid().optional(),
  cursor: z.string().cuid().optional(),
});

const getRequestSchema = z.object({
  id: z.string().cuid(),
  branchId: z.string().cuid().optional(),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
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
 * Business radar (M5-W1 / N1–N2): OPEN service requests near an ACTIVE branch,
 * filtered by the business catalog and excluding requests already quoted by
 * this business. Privacy gating never exposes addressLine — only neighborhood
 * + coordinates rounded to 3 decimals (MA-13).
 */
export const radarRouter = createTRPCRouter({
  listOpenRequests: activeBusinessProcedure
    .input(listOpenRequestsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listOpenRequests(ctx.db, {
          businessId: ctx.business.id,
          userId: ctx.session.user.id,
          branchId: input.branchId,
          cursor: input.cursor,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Radar list failed");
        }

        return ok(list.data, "Open requests loaded");
      } catch (error) {
        return unexpectedFailure(error, "Radar list failed");
      }
    }),

  getRequest: activeBusinessProcedure
    .input(getRequestSchema)
    .query(async ({ ctx, input }) => {
      try {
        const request = await getRadarRequest(ctx.db, {
          businessId: ctx.business.id,
          userId: ctx.session.user.id,
          requestId: input.id,
          branchId: input.branchId,
        });

        if (!request.ok) {
          return serviceFailure(request.code, "Request not found");
        }

        return ok(request.data, "Request loaded");
      } catch (error) {
        return unexpectedFailure(error, "Request load failed");
      }
    }),
});
