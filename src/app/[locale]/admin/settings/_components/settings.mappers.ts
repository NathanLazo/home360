import type { SettingsFormValues } from "./settings.form";
import type {
  PlanCommissionValues,
  PlatformSettingsValues,
  SaveAdminSettingsInput,
} from "./settings.schema";
import type { PlatformSettingsResult } from "./settings.types";

/**
 * Pure mappers so the pesos ↔ cents conversion lives in exactly one place and
 * never leaks into components. The server revalidates every value anyway.
 */
export function toFormValues(data: PlatformSettingsResult): SettingsFormValues {
  const { settings, commissionsByPlan } = data;

  return {
    aiConfidenceThresholdPct: settings.aiConfidenceThresholdPct,
    aiPriceMarginPct: settings.aiPriceMarginPct,
    aiPricingModel: settings.aiPricingModel,
    aiHumanReviewBelowThreshold: settings.aiHumanReviewBelowThreshold,
    customerServiceFee: settings.customerServiceFeeCents / 100,
    loyaltyBonusPct: settings.loyaltyBonusPct,
    commissionBasic: commissionsByPlan.basic,
    commissionStandard: commissionsByPlan.standard,
    commissionEnterprise: commissionsByPlan.enterprise,
    escrowAutoReleaseHours: settings.escrowAutoReleaseHours,
    notifyNewRequestRadiusKm: settings.notifyNewRequestRadiusKm,
    notifyPaymentRelease: settings.notifyPaymentRelease,
    notifyRatingReminderHours: settings.notifyRatingReminderHours,
  };
}

function toSettingsValues(values: SettingsFormValues): PlatformSettingsValues {
  return {
    aiConfidenceThresholdPct: values.aiConfidenceThresholdPct,
    aiPriceMarginPct: values.aiPriceMarginPct,
    aiPricingModel: values.aiPricingModel,
    aiHumanReviewBelowThreshold: values.aiHumanReviewBelowThreshold,
    customerServiceFeeCents: Math.round(values.customerServiceFee * 100),
    loyaltyBonusPct: values.loyaltyBonusPct,
    escrowAutoReleaseHours: values.escrowAutoReleaseHours,
    notifyNewRequestRadiusKm: values.notifyNewRequestRadiusKm,
    notifyPaymentRelease: values.notifyPaymentRelease,
    notifyRatingReminderHours: values.notifyRatingReminderHours,
  };
}

function toCommissionValues(values: SettingsFormValues): PlanCommissionValues {
  return {
    basic: values.commissionBasic,
    standard: values.commissionStandard,
    enterprise: values.commissionEnterprise,
  };
}

function shallowEqual<T extends Record<string, unknown>>(
  left: T,
  right: T,
): boolean {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

/**
 * The commission update needs all three values, so any dirty commission
 * sends the whole trio together with what the form believed they were.
 */
export function toSaveInput(
  values: SettingsFormValues,
  current: PlatformSettingsResult,
): SaveAdminSettingsInput | null {
  const nextSettings = toSettingsValues(values);
  const currentSettings = toSettingsValues(toFormValues(current));
  const nextCommissions = toCommissionValues(values);
  const settingsChanged = !shallowEqual(nextSettings, currentSettings);
  const commissionsChanged = !shallowEqual(
    nextCommissions,
    current.commissionsByPlan,
  );

  if (!settingsChanged && !commissionsChanged) {
    return null;
  }

  return {
    expectedUpdatedAt: current.settings.updatedAt,
    ...(settingsChanged ? { settings: nextSettings } : {}),
    ...(commissionsChanged
      ? {
          commissions: nextCommissions,
          expectedCommissions: current.commissionsByPlan,
        }
      : {}),
  };
}
