import "server-only";

import { OrderStatus, Prisma, type PrismaClient } from "@generated/prisma";
import { recalculateBusinessRating } from "~/server/services/reviews/business-rating";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type CreateReviewInput = {
  customerId: string;
  orderId: string;
  rating: number;
  comment?: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Recalculates `Worker.ratingAvg` from every review of the orders assigned
 * to the worker. Full recalculation (never increments), same discipline as
 * `recalculateBusinessRating`, so the denormalized value cannot drift.
 */
async function recalculateWorkerRating(
  tx: Prisma.TransactionClient,
  workerId: string,
): Promise<void> {
  const aggregate = await tx.review.aggregate({
    where: { order: { workerId } },
    _avg: { rating: true },
  });

  await tx.worker.update({
    where: { id: workerId },
    data: { ratingAvg: aggregate._avg.rating },
  });
}

/**
 * Customer review of an own COMPLETED order (P-WEB-02, C6 confirmation). One
 * review per order is enforced by `Review.orderId @unique`: a second attempt
 * answers CONFLICT. The business and worker aggregates are recalculated in
 * the same transaction as the insert.
 */
export async function createOrderReview(
  db: PrismaClient,
  input: CreateReviewInput,
): Promise<ServiceResult<{ reviewId: string }>> {
  try {
    return await db.$transaction(async (tx) => {
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
        return svcFail("NOT_FOUND", "Order not found");
      }

      if (order.status !== OrderStatus.COMPLETED) {
        return svcFail("CONFLICT", "Only completed orders can be reviewed");
      }

      if (order.review) {
        return svcFail("CONFLICT", "Order already reviewed");
      }

      const comment = input.comment?.trim();
      const review = await tx.review.create({
        data: {
          orderId: order.id,
          customerId: input.customerId,
          rating: input.rating,
          comment: comment?.length ? comment : null,
        },
        select: { id: true },
      });

      await recalculateBusinessRating(tx, order.businessId);

      if (order.workerId) {
        await recalculateWorkerRating(tx, order.workerId);
      }

      return svcOk({ reviewId: review.id });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return svcFail("CONFLICT", "Order already reviewed");
    }

    throw error;
  }
}
