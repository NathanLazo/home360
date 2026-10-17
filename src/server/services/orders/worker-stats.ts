import "server-only";

import { OrderStatus, Prisma, type PrismaClient } from "@generated/prisma";

export type WorkerStats = {
  completedCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** % of completed orders with a schedule where the worker arrived on time; null without data. */
  onTimePct: number | null;
};

type OnTimeRow = { total: number; onTime: number };

/**
 * T4 stats for the signed-in worker in one round trip of aggregates.
 * "On time" = first ARRIVED event at or before `Quote.scheduledFor`, over
 * COMPLETED orders that had a schedule; orders never marked ARRIVED count as late.
 */
export async function getWorkerStats(
  db: PrismaClient,
  input: { workerId: string },
): Promise<WorkerStats> {
  const [completedCount, worker, ratingCount, onTimeRows] = await Promise.all([
    db.order.count({
      where: { workerId: input.workerId, status: OrderStatus.COMPLETED },
    }),
    db.worker.findUnique({
      where: { id: input.workerId },
      select: { ratingAvg: true },
    }),
    db.review.count({ where: { order: { workerId: input.workerId } } }),
    db.$queryRaw<OnTimeRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE arrival."arrivedAt" <= q."scheduledFor")::int AS "onTime"
      FROM "Order" o
      JOIN "Quote" q ON q."id" = o."quoteId"
      LEFT JOIN LATERAL (
        SELECT MIN(e."createdAt") AS "arrivedAt"
        FROM "OrderEvent" e
        WHERE e."orderId" = o."id" AND e."type" = 'ARRIVED'
      ) arrival ON TRUE
      WHERE o."workerId" = ${input.workerId}
        AND o."status" = 'COMPLETED'
        AND q."scheduledFor" IS NOT NULL
    `),
  ]);

  const onTime = onTimeRows[0];

  return {
    completedCount,
    ratingAvg: worker?.ratingAvg ?? null,
    ratingCount,
    onTimePct:
      onTime && onTime.total > 0
        ? Math.round((onTime.onTime / onTime.total) * 100)
        : null,
  };
}
