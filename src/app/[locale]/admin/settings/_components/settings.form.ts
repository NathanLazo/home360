import { z } from "zod";

import {
  AI_PRICING_MODELS,
  SETTINGS_RANGES,
} from "./settings.schema";

/**
 * The form schema is complete from the start — AI, escrow, fees and
 * notifications — even though F5-14 only renders the first two sections. That
 * way F5-15 adds section components and i18n keys without touching the submit.
 *
 * Ranges mirror `settings.schema.ts`, which stays the authoritative wire
 * contract; the only difference is that the service fee is captured in pesos.
 */
const intInRange = (range: { min: number; max: number }) =>
  z.number().int().min(range.min).max(range.max);

const feeRangeInPesos = {
  min: SETTINGS_RANGES.customerServiceFeeCents.min / 100,
  max: SETTINGS_RANGES.customerServiceFeeCents.max / 100,
};

export const settingsFormSchema = z.object({
  // AI
  aiConfidenceThresholdPct: intInRange(SETTINGS_RANGES.aiConfidenceThresholdPct),
  aiPriceMarginPct: intInRange(SETTINGS_RANGES.aiPriceMarginPct),
  aiPricingModel: z.enum(AI_PRICING_MODELS),
  aiHumanReviewBelowThreshold: z.boolean(),
  // Fees (captured in pesos, sent in cents)
  customerServiceFee: z.number().min(feeRangeInPesos.min).max(feeRangeInPesos.max),
  loyaltyBonusPct: intInRange(SETTINGS_RANGES.loyaltyBonusPct),
  commissionBasic: intInRange(SETTINGS_RANGES.commissionPct),
  commissionStandard: intInRange(SETTINGS_RANGES.commissionPct),
  commissionEnterprise: intInRange(SETTINGS_RANGES.commissionPct),
  // Escrow
  escrowAutoReleaseHours: intInRange(SETTINGS_RANGES.escrowAutoReleaseHours),
  // Notifications
  notifyNewRequestRadiusKm: intInRange(SETTINGS_RANGES.notifyNewRequestRadiusKm),
  notifyPaymentRelease: z.boolean(),
  notifyRatingReminderHours: intInRange(
    SETTINGS_RANGES.notifyRatingReminderHours,
  ),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export const FEE_RANGE_IN_PESOS = feeRangeInPesos;

/** Visual presets; a persisted value outside them is added dynamically. */
export const NOTIFY_RADIUS_PRESETS_KM = [5, 10, 25, 50] as const;

export const NOTIFY_REMINDER_PRESETS_HOURS = [12, 24, 48] as const;
