import "server-only";

import type { PrismaClient } from "@generated/prisma";

const PLATFORM_SETTINGS_ID = 1;

/** Schema defaults, used only when the singleton was never seeded. */
const DEFAULTS = {
  notifyPaymentRelease: true,
  notifyRatingReminderHours: 24,
  aiConfidenceThresholdPct: 85,
  aiHumanReviewBelowThreshold: true,
} as const;

type SettingsDb = Pick<PrismaClient, "platformSettings">;

/**
 * W13 "Avisar liberación de pago": gates the push sent to the business owner
 * when escrow is released (customer confirmation or auto-release).
 */
export async function isPaymentReleaseNotificationEnabled(
  db: SettingsDb,
): Promise<boolean> {
  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { notifyPaymentRelease: true },
  });

  return settings?.notifyPaymentRelease ?? DEFAULTS.notifyPaymentRelease;
}

/** W13 "Recordatorio de calificación": hours after completion. */
export async function getRatingReminderHours(db: SettingsDb): Promise<number> {
  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { notifyRatingReminderHours: true },
  });

  return (
    settings?.notifyRatingReminderHours ?? DEFAULTS.notifyRatingReminderHours
  );
}

/**
 * W13 "Revisión humana bajo el umbral": a diagnosis whose confidence falls
 * below the admin threshold is flagged for human review while the flag is on.
 */
export async function requiresHumanReview(
  db: SettingsDb,
  confidencePct: number,
): Promise<boolean> {
  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: {
      aiConfidenceThresholdPct: true,
      aiHumanReviewBelowThreshold: true,
    },
  });

  const enabled =
    settings?.aiHumanReviewBelowThreshold ??
    DEFAULTS.aiHumanReviewBelowThreshold;
  const threshold =
    settings?.aiConfidenceThresholdPct ?? DEFAULTS.aiConfidenceThresholdPct;

  return enabled && confidencePct < threshold;
}
