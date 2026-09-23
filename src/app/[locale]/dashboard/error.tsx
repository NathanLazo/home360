"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ reset }: DashboardErrorProps) {
  const t = useTranslations("dashboard.home");

  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title={t("errorTitle")}
      description={t("errorDescription")}
      action={
        <Button type="button" onClick={reset}>
          <RotateCcwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      }
    />
  );
}
