import { z } from "zod";

import { PLAN_CODES, type PlanCode } from "~/lib/subscription/plan-codes";

/**
 * PROVISIONAL — pending Roger's decision (gate #14 of `spec/tickets/README.md`).
 *
 * The spec fixes only three ranges ("threshold 50–99, margin 5–50, hours 1–336…");
 * the remaining bounds and the AI model catalogue below are the values proposed
 * by F5-13 so the screen is implementable. They are gathered here so approving
 * a different set is a one-file edit, and they are authoritative on the server:
 * the UI reuses this very schema.
 */
export const AI_PRICING_MODELS = ["v3.0", "v3.1", "v3.2"] as const;

export const aiPricingModelSchema = z.enum(AI_PRICING_MODELS);

export type AiPricingModel = (typeof AI_PRICING_MODELS)[number];

export const SETTINGS_RANGES = {
  aiConfidenceThresholdPct: { min: 50, max: 99 },
  /** Magnitude of a symmetric ± band; the sign is UI copy only. */
  aiPriceMarginPct: { min: 5, max: 50 },
  customerServiceFeeCents: { min: 0, max: 20_000 },
  loyaltyBonusPct: { min: 0, max: 100 },
  escrowAutoReleaseHours: { min: 1, max: 336 },
  notifyNewRequestRadiusKm: { min: 1, max: 100 },
  notifyRatingReminderHours: { min: 1, max: 168 },
  commissionPct: { min: 0, max: 30 },
} as const;

const intInRange = (range: { min: number; max: number }) =>
  z.number().int().min(range.min).max(range.max);

export const platformSettingsSchema = z
  .object({
    aiConfidenceThresholdPct: intInRange(
      SETTINGS_RANGES.aiConfidenceThresholdPct,
    ),
    aiPriceMarginPct: intInRange(SETTINGS_RANGES.aiPriceMarginPct),
    aiPricingModel: z.enum(AI_PRICING_MODELS),
    aiHumanReviewBelowThreshold: z.boolean(),
    customerServiceFeeCents: intInRange(
      SETTINGS_RANGES.customerServiceFeeCents,
    ),
    // D3: the loyalty bonus is a percentage of the service fee, not a fixed
    // amount per volume.
    loyaltyBonusPct: intInRange(SETTINGS_RANGES.loyaltyBonusPct),
    escrowAutoReleaseHours: intInRange(SETTINGS_RANGES.escrowAutoReleaseHours),
    notifyNewRequestRadiusKm: intInRange(
      SETTINGS_RANGES.notifyNewRequestRadiusKm,
    ),
    notifyPaymentRelease: z.boolean(),
    notifyRatingReminderHours: intInRange(
      SETTINGS_RANGES.notifyRatingReminderHours,
    ),
  })
  .strict();

export type PlatformSettingsValues = z.infer<typeof platformSettingsSchema>;

export const platformSettingsPatchSchema = platformSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "no fields to update",
  });

export const updatePlatformSettingsSchema = z
  .object({
    expectedUpdatedAt: z.coerce.date(),
    patch: platformSettingsPatchSchema,
  })
  .strict();

const commissionPct = intInRange(SETTINGS_RANGES.commissionPct);

export const planCommissionValuesSchema = z
  .object({
    basic: commissionPct,
    standard: commissionPct,
    enterprise: commissionPct,
  })
  .strict();

export type PlanCommissionValues = z.infer<typeof planCommissionValuesSchema>;

/**
 * The single W13 submit cannot be atomic across two sequential mutations, so
 * the screen uses `save`: one transaction, optimistic control through
 * `expectedUpdatedAt` and the expected commissions.
 */
export const saveAdminSettingsSchema = z
  .object({
    expectedUpdatedAt: z.coerce.date(),
    settings: platformSettingsPatchSchema.optional(),
    expectedCommissions: planCommissionValuesSchema.optional(),
    commissions: planCommissionValuesSchema.optional(),
  })
  .strict()
  .refine((value) => value.settings ?? value.commissions, {
    message: "no changes",
  })
  .refine(
    (value) =>
      Boolean(value.commissions) === Boolean(value.expectedCommissions),
    { message: "commissions and expectedCommissions must be sent together" },
  );

export type SaveAdminSettingsInput = z.infer<typeof saveAdminSettingsSchema>;

export const SETTINGS_PLAN_CODES: readonly PlanCode[] = PLAN_CODES;
