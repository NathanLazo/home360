import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  consumerProcedure,
  type ConsumerContext,
} from "~/server/api/consumer-procedure";
import { createTRPCRouter } from "~/server/api/trpc";
import { REQUEST_CATEGORIES } from "~/server/services/ai/diagnose";
import { diagnoseRequestMedia } from "~/server/services/marketplace/diagnose-request";
import type { RequestLocationInput } from "~/server/services/marketplace/request-location";
import {
  cancelMyRequest,
  createServiceRequest,
  getMyRequest,
  listMyRequests,
  type RequestDiagnosisSource,
} from "~/server/services/marketplace/request";

const MAX_MEDIA_PER_REQUEST = 5;

// Blob pathnames issued by media.createUploadUrl (M0-W3); ownership and kind
// are enforced by the service against the session user.
const mediaPathnamesSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(MAX_MEDIA_PER_REQUEST);

const diagnoseSchema = z.object({
  mediaPathnames: mediaPathnamesSchema.min(1),
  description: z.string().trim().max(1_000).optional(),
});

/**
 * Exactly one location source is required: CUSTOMER sends `addressId`, an
 * active corporate consumer sends `corporateLocationId` (validated by role in
 * the procedure). `diagnosisId` reuses a `request.diagnose` result and
 * `category` is the manual fallback after `AI_UNAVAILABLE`.
 */
const createRequestSchema = z
  .object({
    mediaPathnames: mediaPathnamesSchema.default([]),
    description: z.string().trim().max(1_000).optional(),
    addressId: z.string().cuid().optional(),
    corporateLocationId: z.string().cuid().optional(),
    diagnosisId: z.string().cuid().optional(),
    category: z.enum(REQUEST_CATEGORIES).optional(),
  })
  .refine(
    (input) =>
      (input.addressId === undefined) !==
      (input.corporateLocationId === undefined),
    { message: "Exactly one location is required", path: ["addressId"] },
  )
  .refine(
    (input) => input.diagnosisId === undefined || input.category === undefined,
    { message: "Use a diagnosis or a manual category", path: ["category"] },
  )
  .refine(
    (input) =>
      input.diagnosisId !== undefined ||
      input.category !== undefined ||
      input.mediaPathnames.length > 0,
    { message: "Media is required to diagnose", path: ["mediaPathnames"] },
  );

type CreateRequestSchemaInput = z.infer<typeof createRequestSchema>;

const requestIdSchema = z.object({ id: z.string().cuid() });

const listMineSchema = z
  .object({ cursor: z.string().cuid().optional() })
  .optional();

/**
 * HTTP status per service code. `AI_UNAVAILABLE` is a 503: the request is
 * valid, the diagnosis backend is not reachable right now (the app offers the
 * manual category picker).
 */
const serviceErrorStatuses = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  STRIPE_ERROR: 502,
  LOCATION_COORDINATES_REQUIRED: 422,
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

/** Maps the consumer role to the only location source it may use. */
function toLocationInput(
  consumer: ConsumerContext,
  input: CreateRequestSchemaInput,
): RequestLocationInput | null {
  if (consumer.kind === "CUSTOMER") {
    return input.addressId
      ? {
          kind: "ADDRESS",
          customerId: consumer.userId,
          addressId: input.addressId,
        }
      : null;
  }

  return input.corporateLocationId
    ? {
        kind: "CORPORATE_LOCATION",
        corporateAccountId: consumer.corporateAccountId,
        corporateLocationId: input.corporateLocationId,
      }
    : null;
}

function toDiagnosisSource(
  input: CreateRequestSchemaInput,
): RequestDiagnosisSource {
  if (input.diagnosisId !== undefined) {
    return { kind: "STORED", diagnosisId: input.diagnosisId };
  }

  if (input.category !== undefined) {
    return { kind: "MANUAL", category: input.category };
  }

  return { kind: "AI" };
}

/**
 * Consumer service requests (M2-W2 + workstream D): media uploaded in C2 is
 * diagnosed (standalone `diagnose` or inline) and persisted as an OPEN
 * request. CUSTOMER and ACTIVE corporate consumers share the flow; tenant
 * always comes from the session and a foreign request answers NOT_FOUND.
 */
export const requestRouter = createTRPCRouter({
  diagnose: consumerProcedure
    .input(diagnoseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const diagnosed = await diagnoseRequestMedia(ctx.db, {
          userId: ctx.consumer.userId,
          mediaPathnames: input.mediaPathnames,
          description: input.description,
        });

        if (!diagnosed.ok) {
          return serviceFailure(diagnosed.code, "Diagnosis failed");
        }

        return ok(diagnosed.data, "Diagnosis ready", 201);
      } catch (error) {
        return unexpectedFailure(error, "Diagnosis failed");
      }
    }),

  create: consumerProcedure
    .input(createRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const location = toLocationInput(ctx.consumer, input);

        if (!location) {
          return serviceFailure(
            "VALIDATION_ERROR",
            "Location does not match the consumer role",
          );
        }

        const created = await createServiceRequest(ctx.db, {
          customerId: ctx.consumer.userId,
          mediaPathnames: input.mediaPathnames,
          description: input.description,
          location,
          diagnosis: toDiagnosisSource(input),
        });

        if (!created.ok) {
          return serviceFailure(created.code, "Request creation failed");
        }

        return ok(created.data, "Request created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Request creation failed");
      }
    }),

  getById: consumerProcedure
    .input(requestIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const request = await getMyRequest(ctx.db, {
          customerId: ctx.consumer.userId,
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

  listMine: consumerProcedure
    .input(listMineSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMyRequests(ctx.db, {
          customerId: ctx.consumer.userId,
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

  cancel: consumerProcedure
    .input(requestIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const cancelled = await cancelMyRequest(ctx.db, {
          customerId: ctx.consumer.userId,
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
