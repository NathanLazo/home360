import "server-only";

import {
  AdminAuditAction,
  type PrismaClient,
} from "../../../../generated/prisma";

import { writeAdminAudit } from "./admin-audit";

import {
  aiPricingModelSchema,
  SETTINGS_PLAN_CODES,
  type PlanCommissionValues,
  type PlatformSettingsValues,
  type SaveAdminSettingsInput,
} from "~/app/[locale]/admin/settings/_components/settings.schema";
import type { PlanCode } from "~/lib/subscription/plan-codes";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PLATFORM_SETTINGS_ID = 1;

export type SettingsErrorCode = "NOT_FOUND" | "SETTINGS_STALE";

export interface PlatformSettingsResult {
  settings: PlatformSettingsValues & { updatedAt: Date };
  commissionsByPlan: PlanCommissionValues;
}

type SettingsDb = Pick<
  PrismaClient,
  "adminAuditLog" | "plan" | "platformSettings" | "$transaction"
>;

const settingsSelect = {
  aiConfidenceThresholdPct: true,
  aiPriceMarginPct: true,
  aiPricingModel: true,
  aiHumanReviewBelowThreshold: true,
  customerServiceFeeCents: true,
  loyaltyBonusPct: true,
  escrowAutoReleaseHours: true,
  notifyNewRequestRadiusKm: true,
  notifyPaymentRelease: true,
  notifyRatingReminderHours: true,
  updatedAt: true,
} as const;

function toCommissions(
  plans: Array<{ code: string; commissionPct: number }>,
): PlanCommissionValues | null {
  const byCode = new Map(plans.map((plan) => [plan.code, plan.commissionPct]));
  const values: Partial<Record<PlanCode, number>> = {};

  for (const code of SETTINGS_PLAN_CODES) {
    const commissionPct = byCode.get(code);

    if (commissionPct === undefined) {
      return null;
    }

    values[code] = commissionPct;
  }

  const { basic, standard, enterprise } = values;

  return basic === undefined ||
    standard === undefined ||
    enterprise === undefined
    ? null
    : { basic, standard, enterprise };
}

export async function getPlatformSettings(deps: {
  db: SettingsDb;
}): Promise<ServiceResult<PlatformSettingsResult, SettingsErrorCode>> {
  const [settings, plans] = await Promise.all([
    deps.db.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
      select: settingsSelect,
    }),
    deps.db.plan.findMany({ select: { code: true, commissionPct: true } }),
  ]);

  if (!settings) {
    return svcFail("NOT_FOUND", "Platform settings are not seeded");
  }

  const commissionsByPlan = toCommissions(plans);

  if (!commissionsByPlan) {
    return svcFail("NOT_FOUND", "A plan is missing from the catalogue");
  }

  // The column is a free String; a value outside the approved catalogue is
  // reported instead of being silently coerced into the enum.
  const pricingModel = aiPricingModelSchema.safeParse(settings.aiPricingModel);

  if (!pricingModel.success) {
    return svcFail("NOT_FOUND", "Unknown AI pricing model stored");
  }

  return svcOk({
    settings: { ...settings, aiPricingModel: pricingModel.data },
    commissionsByPlan,
  });
}

async function applyCommissions(
  tx: Pick<PrismaClient, "plan">,
  expected: PlanCommissionValues,
  commissions: PlanCommissionValues,
): Promise<boolean> {
  for (const code of SETTINGS_PLAN_CODES) {
    // Compare-and-set per plan: a concurrent edit leaves count 0 rather than
    // silently overwriting the other admin's value.
    const updated = await tx.plan.updateMany({
      where: { code, commissionPct: expected[code] },
      data: { commissionPct: commissions[code] },
    });

    if (updated.count === 0) {
      return false;
    }
  }

  return true;
}

export async function updatePlatformSettings(
  deps: { db: SettingsDb },
  input: {
    expectedUpdatedAt: Date;
    patch: Partial<PlatformSettingsValues>;
  },
): Promise<ServiceResult<PlatformSettingsResult, SettingsErrorCode>> {
  const updated = await deps.db.platformSettings.updateMany({
    where: { id: PLATFORM_SETTINGS_ID, updatedAt: input.expectedUpdatedAt },
    data: input.patch,
  });

  if (updated.count === 0) {
    return svcFail("SETTINGS_STALE", "Platform settings changed meanwhile");
  }

  return getPlatformSettings(deps);
}

export async function updatePlanCommissions(
  deps: { db: SettingsDb },
  input: { expected: PlanCommissionValues; commissions: PlanCommissionValues },
): Promise<ServiceResult<PlatformSettingsResult, SettingsErrorCode>> {
  const applied = await deps.db.$transaction(async (tx) =>
    applyCommissions(tx, input.expected, input.commissions),
  );

  if (!applied) {
    return svcFail("SETTINGS_STALE", "Plan commissions changed meanwhile");
  }

  return getPlatformSettings(deps);
}

/**
 * Single-submit path for W13: either every group lands or none does. Changing
 * a commission never touches `Payment`: the percentage and amount are frozen
 * per payment at capture time, so this only affects future charges.
 */
export async function saveAdminSettings(
  deps: { db: SettingsDb },
  input: SaveAdminSettingsInput & { adminId: string },
): Promise<ServiceResult<PlatformSettingsResult, SettingsErrorCode>> {
  const before = await getPlatformSettings(deps);

  const applied = await deps.db.$transaction(async (tx) => {
    if (input.settings) {
      const updated = await tx.platformSettings.updateMany({
        where: { id: PLATFORM_SETTINGS_ID, updatedAt: input.expectedUpdatedAt },
        data: input.settings,
      });

      if (updated.count === 0) {
        return false;
      }
    }

    if (
      input.commissions &&
      input.expectedCommissions &&
      !(await applyCommissions(
        tx,
        input.expectedCommissions,
        input.commissions,
      ))
    ) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.SETTINGS_UPDATED,
      before: before.ok
        ? { ...before.data.settings, updatedAt: before.data.settings.updatedAt.toISOString() }
        : {},
      after: { ...(input.settings ?? {}), ...(input.commissions ?? {}) },
    });

    return true;
  });

  if (!applied) {
    return svcFail("SETTINGS_STALE", "Settings changed meanwhile");
  }

  return getPlatformSettings(deps);
}
