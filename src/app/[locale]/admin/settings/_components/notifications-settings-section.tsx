"use client";

import { BellIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, type UseFormReturn } from "react-hook-form";

import { SettingsNumberField } from "./settings-number-field";
import { SettingsSectionCard } from "./settings-section-card";
import type { SettingsFormValues } from "./settings.form";
import { SETTINGS_RANGES } from "./settings.schema";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function NotificationsSettingsSection({
  form,
}: {
  form: UseFormReturn<SettingsFormValues>;
}) {
  const t = useTranslations("admin.settings.notifications");

  return (
    <SettingsSectionCard
      title={t("title")}
      description={t("description")}
      icon={BellIcon}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SettingsNumberField
          form={form}
          name="notifyNewRequestRadiusKm"
          label={t("radius")}
          hint={t("radiusHint", SETTINGS_RANGES.notifyNewRequestRadiusKm)}
          min={SETTINGS_RANGES.notifyNewRequestRadiusKm.min}
          max={SETTINGS_RANGES.notifyNewRequestRadiusKm.max}
          suffix="km"
        />
        <SettingsNumberField
          form={form}
          name="notifyRatingReminderHours"
          label={t("ratingReminder")}
          hint={t(
            "ratingReminderHint",
            SETTINGS_RANGES.notifyRatingReminderHours,
          )}
          min={SETTINGS_RANGES.notifyRatingReminderHours.min}
          max={SETTINGS_RANGES.notifyRatingReminderHours.max}
          suffix={t("hoursSuffix")}
        />
      </div>

      <Controller
        control={form.control}
        name="notifyPaymentRelease"
        render={({ field }) => (
          <div className="bg-canvas-soft flex items-start justify-between gap-4 rounded-md border p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="notify-payment-release">
                {t("paymentRelease")}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t("paymentReleaseHint")}
              </p>
            </div>
            <Switch
              id="notify-payment-release"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </div>
        )}
      />

      <p
        role="note"
        className="text-muted-foreground flex items-start gap-2 text-xs"
      >
        <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("consumerNote")}
      </p>
    </SettingsSectionCard>
  );
}
