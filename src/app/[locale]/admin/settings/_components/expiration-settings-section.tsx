"use client";

import { HourglassIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";

import { SettingsNumberField } from "./settings-number-field";
import { SettingsSectionCard } from "./settings-section-card";
import type { SettingsFormValues } from "./settings.form";
import { SETTINGS_RANGES } from "./settings.schema";

/**
 * D10-5 expiration windows: how long an unpaid order keeps its stock
 * reserved before the cron cancels it, and how long a new request accepts
 * offers.
 */
export function ExpirationSettingsSection({
  form,
}: {
  form: UseFormReturn<SettingsFormValues>;
}) {
  const t = useTranslations("admin.settings.expiration");

  return (
    <SettingsSectionCard
      id="expiration"
      title={t("title")}
      description={t("description")}
      icon={HourglassIcon}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SettingsNumberField
          form={form}
          name="unpaidOrderTtlMinutes"
          label={t("unpaidOrder")}
          hint={t("unpaidOrderHint", SETTINGS_RANGES.unpaidOrderTtlMinutes)}
          min={SETTINGS_RANGES.unpaidOrderTtlMinutes.min}
          max={SETTINGS_RANGES.unpaidOrderTtlMinutes.max}
          suffix={t("minutesSuffix")}
        />
        <SettingsNumberField
          form={form}
          name="requestTtlHours"
          label={t("request")}
          hint={t("requestHint", SETTINGS_RANGES.requestTtlHours)}
          min={SETTINGS_RANGES.requestTtlHours.min}
          max={SETTINGS_RANGES.requestTtlHours.max}
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
