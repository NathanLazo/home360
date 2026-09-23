"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";

export default function SettingsError({ reset }: { reset: () => void }) {
  const t = useTranslations("dashboard.settings");
  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title={t("errorTitle")}
      description={t("errorDescription")}
      action={
        <Button type="button" onClick={reset} className="min-h-11">
          <RotateCcwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      }
    />
  );
}
