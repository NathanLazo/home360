import "server-only";

import { PaymentStatus, type Prisma } from "@generated/prisma";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const DEFAULT_ESCROW_AUTO_RELEASE_HOURS = 72;

type AutoReleaseDb = Pick<
  Prisma.TransactionClient,
  "payment" | "platformSettings"
>;

/**
 * D10-3: the auto-release clock arms when the provider asks the customer to
 * confirm (CONFIRMATION_REQUESTED written by WORK_DONE / DELIVERED), never at
 * capture. Every confirmation request restarts the window from now, so a
 * rework (which pauses it with `escrowReleaseAt = null`) or a late delivery
 * always gives the customer the full `escrowAutoReleaseHours`.
 *
 * Runs inside the caller's transaction; only an IN_ESCROW payment is armed.
 */
export async function armAutoRelease(
  tx: AutoReleaseDb,
  input: { paymentId: string; now?: Date },
): Promise<Date> {
  const settings = await tx.platformSettings.findUnique({
    where: { id: 1 },
    select: { escrowAutoReleaseHours: true },
  });
  const hours =
    settings &&
    Number.isInteger(settings.escrowAutoReleaseHours) &&
    settings.escrowAutoReleaseHours >= 0
      ? settings.escrowAutoReleaseHours
      : DEFAULT_ESCROW_AUTO_RELEASE_HOURS;
  const now = input.now ?? new Date();
  const escrowReleaseAt = new Date(
    now.getTime() + hours * MILLISECONDS_PER_HOUR,
  );

  await tx.payment.updateMany({
    where: { id: input.paymentId, status: PaymentStatus.IN_ESCROW },
    data: { escrowReleaseAt },
  });

  return escrowReleaseAt;
}
