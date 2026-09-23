import "server-only";

import { OrderStatus, type PrismaClient } from "@generated/prisma";

import { sendLocalizedPushToUser } from "../push/messages";
import { svcOk, type ServiceResult } from "../service-result";
import { getRatingReminderHours } from "../settings/platform-policies";

const HOUR_MS = 60 * 60 * 1000;

/** Orders completed longer ago than this are never reminded (first deploy). */
const LOOKBACK_DAYS = 14;

const BATCH_SIZE = 200;

export type RatingRemindersResult = {
  candidates: number;
  reminded: number;
};

/**
 * Cron job behind W13 "Recordatorio de calificación": pushes the customer of
 * every COMPLETED order without a review once `notifyRatingReminderHours`
 * have passed since completion (escrow release, or the last order update for
 * orders without payment). `Order.ratingReminderSentAt` is claimed with a
 * conditional write before sending, so overlapping runs never double-send.
 */
export async function sendDueRatingReminders(deps: {
  db: PrismaClient;
  now?: Date;
}): Promise<ServiceResult<RatingRemindersResult>> {
  const now = deps.now ?? new Date();
  const hours = await getRatingReminderHours(deps.db);
  const cutoff = new Date(now.getTime() - hours * HOUR_MS);
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR_MS);

  const due = await deps.db.order.findMany({
    where: {
      status: OrderStatus.COMPLETED,
      ratingReminderSentAt: null,
      review: { is: null },
      OR: [
        {
          payment: {
            is: { releasedAt: { lte: cutoff, gte: lookback } },
          },
        },
        {
          payment: { is: null },
          updatedAt: { lte: cutoff, gte: lookback },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, customerId: true },
  });

  let reminded = 0;

  for (const order of due) {
    const claimed = await deps.db.order.updateMany({
      where: { id: order.id, ratingReminderSentAt: null },
      data: { ratingReminderSentAt: now },
    });

    if (claimed.count === 0) {
      continue;
    }

    await sendLocalizedPushToUser(deps.db, order.customerId, {
      message: "ratingReminder",
      url: `home360app://orders/${order.id}`,
    });
    reminded += 1;
  }

  return svcOk({ candidates: due.length, reminded });
}
