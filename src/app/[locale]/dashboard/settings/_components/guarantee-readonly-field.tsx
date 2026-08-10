"use client";

import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { GuaranteeTypeValue } from "./settings.types";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/**
 * The guarantee is shown but never submitted: changing it requires HOME360
 * approval, so the field is disabled and the reason is announced with it.
 */
export function GuaranteeReadonlyField({
  guaranteeType,
}: {
  guaranteeType: GuaranteeTypeValue;
}) {
  const t = useTranslations("dashboard.settings.profile");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="settings-guarantee">{t("guaranteeLabel")}</Label>
      <Input
        id="settings-guarantee"
        name="guaranteeType"
        value={t(`guaranteeTypes.${guaranteeType}`)}
        readOnly
        disabled
        aria-describedby="settings-guarantee-note"
      />
      <p
        id="settings-guarantee-note"
        className="text-muted-foreground flex items-start gap-2 text-sm"
      >
        <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("guaranteeNote")}
      </p>
    </div>
  );
}
