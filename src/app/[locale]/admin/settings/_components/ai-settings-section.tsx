"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, type UseFormReturn } from "react-hook-form";

import { SettingsNumberField } from "./settings-number-field";
import { SettingsSectionCard } from "./settings-section-card";
import type { SettingsFormValues } from "./settings.form";
import { AI_PRICING_MODELS, SETTINGS_RANGES } from "./settings.schema";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";

export function AiSettingsSection({
  form,
}: {
  form: UseFormReturn<SettingsFormValues>;
}) {
  const t = useTranslations("admin.settings.ai");

  return (
    <SettingsSectionCard
      id="ai"
      title={t("title")}
      description={t("description")}
      icon={SparklesIcon}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SettingsNumberField
          form={form}
          name="aiConfidenceThresholdPct"
          label={t("threshold")}
          hint={t("thresholdHint", SETTINGS_RANGES.aiConfidenceThresholdPct)}
          min={SETTINGS_RANGES.aiConfidenceThresholdPct.min}
          max={SETTINGS_RANGES.aiConfidenceThresholdPct.max}
          suffix="%"
        />
        <SettingsNumberField
          form={form}
          name="aiPriceMarginPct"
          label={t("margin")}
          hint={t("marginHint", SETTINGS_RANGES.aiPriceMarginPct)}
          min={SETTINGS_RANGES.aiPriceMarginPct.min}
          max={SETTINGS_RANGES.aiPriceMarginPct.max}
          prefix="±"
          suffix="%"
        />

        <Controller
          control={form.control}
          name="aiPricingModel"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-pricing-model">{t("model")}</Label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ai-pricing-model" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PRICING_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t("modelHint")}</p>
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="aiHumanReviewBelowThreshold"
          render={({ field }) => (
            <div className="bg-canvas-soft flex items-start justify-between gap-4 rounded-md border p-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ai-human-review">{t("humanReview")}</Label>
                <p className="text-muted-foreground text-xs">
                  {t("humanReviewHint")}
                </p>
              </div>
              <Switch
                id="ai-human-review"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      </div>
    </SettingsSectionCard>
  );
}
