// No "server-only" here: the seed recalculates the same denormalized rating
// and must be able to import this outside the Next.js runtime.
import type { Prisma } from "../../../../generated/prisma";

/**
 * Recalculates `Business.ratingAvg/ratingCount` from `Review` (aggregated via
 * `Review.order.businessId`) and writes them back. This helper is the ONLY
 * code path allowed to mutate those columns (besides the seed): the future
 * review endpoint (see M4-M2) must call it inside its own transaction — full
 * recalculation, never increments, so the denormalized values cannot drift.
 */
export async function recalculateBusinessRating(
  db: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  const aggregate = await db.review.aggregate({
    where: { order: { businessId } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.business.update({
    where: { id: businessId },
    data: {
      ratingAvg: aggregate._avg.rating,
      ratingCount: aggregate._count.rating,
    },
  });
}
