import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { consumerProcedure } from "~/server/api/consumer-procedure";
import { createTRPCRouter } from "~/server/api/trpc";
import { createOrderReview } from "~/server/services/reviews/create-review";

const createReviewSchema = z.object({
  orderId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1_000).optional(),
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

/** Customer reviews (P-WEB-02): one rating per completed own order. */
export const reviewRouter = createTRPCRouter({
  create: consumerProcedure
    .input(createReviewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await createOrderReview(ctx.db, {
          customerId: ctx.consumer.userId,
          orderId: input.orderId,
          rating: input.rating,
          comment: input.comment,
        });

        if (!created.ok) {
          return serviceFailure(created.code, "Review creation failed");
        }

        return ok(created.data, "Review created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Review creation failed");
      }
    }),
});
