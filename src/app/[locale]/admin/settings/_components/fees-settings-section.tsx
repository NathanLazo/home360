"use client";

import { InfoIcon, PercentIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";

import { SettingsNumberField } from "./settings-number-field";
import { SettingsSectionCard } from "./settings-section-card";
import { FEE_RANGE_IN_PESOS, type SettingsFormValues } from "./settings.form";
import { SETTINGS_RANGES } from "./settings.schema";

const COMMISSION_FIELDS = [
  { name: "commissionBasic", planCode: "basic" },
  { name: "commissionStandard", planCode: "standard" },
  { name: "commissionEnterprise", planCode: "enterprise" },
] as const;

export function FeesSettingsSection({
  form,
}: {
  form: UseFormReturn<SettingsFormValues>;
}) {
  const t = useTranslations("admin.settings.fees");
  const plansT = useTranslations("admin.settings.planNames");

  return (
    <SettingsSectionCard
      id="fees"
      title={t("title")}
      description={t("description")}
      icon={PercentIcon}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        {COMMISSION_FIELDS.map((field) => (
          <SettingsNumberField
            key={field.name}
            form={form}
            name={field.name}
            // Plan labels are translated by code: `Plan.name` in the database
            // is not localized.
            label={t("commissionFor", { plan: plansT(field.planCode) })}
            min={SETTINGS_RANGES.commissionPct.min}
            max={SETTINGS_RANGES.commissionPct.max}
            suffix="%"
          />
        ))}
      </div>

      <p
        role="note"
        className="text-muted-foreground flex items-start gap-2 text-xs"
      >
        <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("futureOnlyNote")}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <SettingsNumberField
          form={form}
          name="customerServiceFee"
          label={t("serviceFee")}
          hint={t("serviceFeeHint", FEE_RANGE_IN_PESOS)}
          min={FEE_RANGE_IN_PESOS.min}
          max={FEE_RANGE_IN_PESOS.max}
          step={0.01}
          prefix="$"
          suffix="MXN"
        />
        <SettingsNumberField
          form={form}
          name="loyaltyBonusPct"
          label={t("loyaltyBonus")}
          hint={t("loyaltyBonusHint")}
          min={SETTINGS_RANGES.loyaltyBonusPct.min}
          max={SETTINGS_RANGES.loyaltyBonusPct.max}
          suffix="%"
        />
      </div>
    </SettingsSectionCard>
  );
}
