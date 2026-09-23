import type { Prisma } from "@generated/prisma";

/**
 * Recalculates `Worker.ratingAvg` from `Review` (aggregated via
 * `Review.order.workerId`, the technician assigned to the order, MA-01) and
 * writes it back. Same contract as `recalculateBusinessRating`: full
 * recalculation inside the caller's transaction, never increments, and the
 * only code path (besides the seed) allowed to mutate that column.
 */
export async function recalculateWorkerRating(
  db: Prisma.TransactionClient,
  workerId: string,
): Promise<void> {
  const aggregate = await db.review.aggregate({
    where: { order: { workerId } },
    _avg: { rating: true },
  });

  await db.worker.update({
    where: { id: workerId },
    data: { ratingAvg: aggregate._avg.rating },
  });
}
