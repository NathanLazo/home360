import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createDownloadUrl,
  createUploadToken,
  MEDIA_KINDS,
} from "~/server/services/media/blob";

/**
 * The zod layer only checks shape; the per-kind content-type and size policy
 * lives in the media service so both stay in one place. The 2 GB recording
 * ceiling is the widest limit any kind accepts.
 */
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

const createUploadTokenSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  contentType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
});

const getDownloadUrlSchema = z.object({
  pathname: z.string().trim().min(1).max(500),
});

/**
 * HTTP status per service code: policy violations are 422, an unknown or
 * foreign pathname is a generic 404 and a missing `BLOB_READ_WRITE_TOKEN`
 * is a clean 500 without crashing the request.
 */
const serviceErrorStatuses = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  CONFLICT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never> {
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
 * Media uploads for the mobile app (M0-W3): the app uploads bytes directly to
 * Vercel Blob with tokens signed here; the backend never receives the file.
 * Signed URLs are returned to the caller only and must never be logged.
 */
export const mediaRouter = createTRPCRouter({
  createUploadToken: protectedProcedure
    .input(createUploadTokenSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const grant = await createUploadToken({
          userId: ctx.session.user.id,
          kind: input.kind,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
        });

        if (!grant.ok) {
          return serviceFailure(grant.code, "Upload token creation failed");
        }

        return ok(grant.data, "Upload token created");
      } catch (error) {
        return unexpectedFailure(error, "Upload token creation failed");
      }
    }),

  getDownloadUrl: protectedProcedure
    .input(getDownloadUrlSchema)
    .query(async ({ ctx, input }) => {
      try {
        const grant = await createDownloadUrl({
          userId: ctx.session.user.id,
          pathname: input.pathname,
        });

        if (!grant.ok) {
          return serviceFailure(grant.code, "Download URL creation failed");
        }

        return ok(grant.data, "Download URL created");
      } catch (error) {
        return unexpectedFailure(error, "Download URL creation failed");
      }
    }),
});
