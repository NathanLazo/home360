"use client";

import { useTranslations } from "next-intl";

import { availableActions, type BusinessRowAction } from "./user-row-actions";
import type { BusinessDetail } from "./users.types";
import { Button } from "~/components/ui/button";

const destructiveActions: ReadonlySet<BusinessRowAction> = new Set([
  "reject",
  "suspend",
]);

export function BusinessDetailActions({
  detail,
  onAction,
}: {
  detail: BusinessDetail;
  onAction: (action: BusinessRowAction) => void;
}) {
  const t = useTranslations("admin.users.actions");
  const actions = availableActions(detail.derivedStatus);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={destructiveActions.has(action) ? "outline" : "default"}
          onClick={() => onAction(action)}
        >
          {t(action)}
        </Button>
      ))}
    </div>
  );
}
