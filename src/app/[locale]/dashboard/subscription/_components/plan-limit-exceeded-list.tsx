"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

type PlanLimitExceededListProps = {
  exceeds: string[];
};

/**
 * Spells out exactly which resources do not fit the target plan, so the
 * business is never left guessing what to remove. The detail comes from the
 * successful result of `previewChange`; the contract cannot carry it in an
 * error.
 */
export function PlanLimitExceededList({ exceeds }: PlanLimitExceededListProps) {
  const t = useTranslations("dashboard.subscription");

  if (exceeds.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{t("changeDialog.doesNotFitTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span>{t("changeDialog.doesNotFitDescription")}</span>
        <ul className="list-disc ps-5">
          {exceeds.map((resource) => (
            <li key={resource}>{t(`usage.${resource}`)}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
