"use client";

import { InfoIcon, LockKeyholeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";

import { SettingsNumberField } from "./settings-number-field";
import { SettingsSectionCard } from "./settings-section-card";
import type { SettingsFormValues } from "./settings.form";
import { SETTINGS_RANGES } from "./settings.schema";

export function EscrowSettingsSection({
  form,
}: {
  form: UseFormReturn<SettingsFormValues>;
}) {
  const t = useTranslations("admin.settings.escrow");

  return (
    <SettingsSectionCard
      title={t("title")}
      description={t("description")}
      icon={LockKeyholeIcon}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SettingsNumberField
          form={form}
          name="escrowAutoReleaseHours"
          label={t("autoReleaseHours")}
          hint={t("autoReleaseHint", SETTINGS_RANGES.escrowAutoReleaseHours)}
          min={SETTINGS_RANGES.escrowAutoReleaseHours.min}
          max={SETTINGS_RANGES.escrowAutoReleaseHours.max}
          suffix={t("hoursSuffix")}
        />
      </div>

      <p
        role="note"
        className="text-muted-foreground flex items-start gap-2 text-xs"
      >
        <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("futureOnlyNote")}
      </p>
    </SettingsSectionCard>
  );
}
