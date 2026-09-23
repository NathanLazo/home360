import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import { createReview } from "~/server/services/reviews/create-review";
import { createReviewSchema } from "~/server/services/reviews/review.schema";

const reviewErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  ORDER_NOT_REVIEWABLE: 409,
  REVIEW_ALREADY_EXISTS: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ReviewErrorCode = keyof typeof reviewErrorStatuses;

function reviewFailure(
  code: ReviewErrorCode,
  message: string,
): TrpcResponse<never, ReviewErrorCode> {
  return fail(code, reviewErrorStatuses[code], message);
}

/**
 * Reviews (P-WEB-02 / C6). Customer-only: the customer comes from the
 * session and ownership of the order is checked in the service.
 */
export const reviewRouter = createTRPCRouter({
  create: userProcedure
    .input(createReviewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await createReview(ctx.db, {
          customerId: ctx.customer.id,
          orderId: input.orderId,
          rating: input.rating,
          comment: input.comment,
        });

        if (!created.ok) {
          return reviewFailure(created.code, "Review create failed");
        }

        return ok(created.data, "Review created", 201);
      } catch (error) {
        const normalized = normalizeError(error);
        return fail(normalized.code, normalized.status, "Review create failed");
      }
    }),
});
