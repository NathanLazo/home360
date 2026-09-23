import "server-only";

import { OrderStatus, Prisma, type PrismaClient } from "@generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { recalculateBusinessRating } from "./business-rating";
import type { CreateReviewInput } from "./review.schema";
import { recalculateWorkerRating } from "./worker-rating";

export type CreateReviewResult = {
  id: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

export type CreateReviewErrorCode =
  | "ORDER_NOT_REVIEWABLE"
  | "REVIEW_ALREADY_EXISTS";

/** Thrown inside the transaction so it rolls back with a stable code. */
class ReviewRejectedError extends Error {
  constructor(readonly code: CreateReviewErrorCode) {
    super(code);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Customer rating from the C6 confirmation (P-WEB-02). Ownership comes from
 * the session: a foreign or unknown order answers a generic NOT_FOUND. Only a
 * COMPLETED order is reviewable, and `Review.orderId @unique` guarantees one
 * review per order even under concurrent submits (P2002 → the same stable
 * code as the pre-check). The business and worker rating aggregates are
 * recalculated in the same transaction as the insert.
 */
export async function createReview(
  db: PrismaClient,
  input: CreateReviewInput & { customerId: string },
): Promise<ServiceResult<CreateReviewResult, CreateReviewErrorCode>> {
  try {
    const review = await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, customerId: input.customerId },
        select: {
          id: true,
          status: true,
          businessId: true,
          workerId: true,
          review: { select: { id: true } },
        },
      });

      if (!order) {
        return null;
      }

      if (order.status !== OrderStatus.COMPLETED) {
        throw new ReviewRejectedError("ORDER_NOT_REVIEWABLE");
      }

      if (order.review) {
        throw new ReviewRejectedError("REVIEW_ALREADY_EXISTS");
      }

      const created = await tx.review.create({
        data: {
          orderId: order.id,
          customerId: input.customerId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
        select: {
          id: true,
          orderId: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      });

      await recalculateBusinessRating(tx, order.businessId);

      if (order.workerId) {
        await recalculateWorkerRating(tx, order.workerId);
      }

      return created;
    });

    if (!review) {
      return svcFail("NOT_FOUND", "Order not found");
    }

    return svcOk(review);
  } catch (error) {
    if (error instanceof ReviewRejectedError) {
      return svcFail(error.code);
    }

    if (isUniqueViolation(error)) {
      return svcFail("REVIEW_ALREADY_EXISTS", "Order already reviewed");
    }

    throw error;
  }
}
