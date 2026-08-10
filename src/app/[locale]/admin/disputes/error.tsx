"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";

export default function AdminDisputesError({ reset }: { reset: () => void }) {
  const t = useTranslations("admin.disputes");
  const commonT = useTranslations("common");

  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title={t("errorTitle")}
      description={t("errorDescription")}
      action={
        <Button
          type="button"
          onClick={reset}
          className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <RotateCcwIcon aria-hidden="true" />
          {commonT("retry")}
        </Button>
      }
    />
  );
}
