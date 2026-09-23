"use client";

import { useTranslations } from "next-intl";

import {
  availableCorporateActions,
  type CorporateRowAction,
} from "./corporate-row-actions";
import type { CorporateStatusValue } from "./corporate.schema";
import { Button } from "~/components/ui/button";

export function CorporateDetailActions({
  status,
  onAction,
}: {
  status: CorporateStatusValue;
  onAction: (action: CorporateRowAction) => void;
}) {
  const t = useTranslations("admin.corporate.actions");
  const actions = availableCorporateActions(status);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={
            action === "suspend" || action === "reconcileBilling"
              ? "outline"
              : "default"
          }
          className="min-h-11 sm:min-h-10"
          onClick={() => onAction(action)}
        >
          {t(action)}
        </Button>
      ))}
    </div>
  );
}
