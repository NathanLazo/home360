import "server-only";

import type { Prisma } from "@generated/prisma";

const MILLISECONDS_PER_MINUTE = 60_000;
export const DEFAULT_UNPAID_ORDER_TTL_MINUTES = 30;

type TtlDb = Pick<Prisma.TransactionClient, "platformSettings">;

/**
 * D10-5 `PlatformSettings.unpaidOrderTtlMinutes` (30 by default). The single
 * read shared by the expiry cron, the payment entry points (`createIntent`,
 * `createProductIntent`, web Checkout Session) and `tracking.canPay`, so an
 * order the cron would cancel can never start a new payment attempt
 * (F10 review M2 / L7).
 */
export async function resolveUnpaidOrderTtlMinutes(db: TtlDb): Promise<number> {
  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { unpaidOrderTtlMinutes: true },
  });

  return settings &&
    Number.isInteger(settings.unpaidOrderTtlMinutes) &&
    settings.unpaidOrderTtlMinutes > 0
    ? settings.unpaidOrderTtlMinutes
    : DEFAULT_UNPAID_ORDER_TTL_MINUTES;
}

/** Orders created at or before this instant are past the unpaid TTL. */
export function unpaidOrderCutoff(ttlMinutes: number, now: Date): Date {
  return new Date(now.getTime() - ttlMinutes * MILLISECONDS_PER_MINUTE);
}

export function isPastUnpaidOrderTtl(
  createdAt: Date,
  ttlMinutes: number,
  now: Date = new Date(),
): boolean {
  return createdAt.getTime() <= unpaidOrderCutoff(ttlMinutes, now).getTime();
}
