"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BusinessDerivedStatus } from "./users.schema";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type BusinessRowAction = "approve" | "reject" | "suspend" | "reactivate";

/**
 * Visibility of the moderation entries by derived status. The mutations
 * themselves land in F5-05 (approve/reject) and F5-06 (suspend/reactivate);
 * this map is the single place that decides what each state may offer.
 */
export function availableActions(
  status: BusinessDerivedStatus,
): BusinessRowAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"];
    case "active":
    case "in_dispute":
      return ["suspend"];
    case "suspended":
      return ["reactivate"];
    case "rejected":
      return [];
  }
}

export type UserRowActionsProps = {
  derivedStatus: BusinessDerivedStatus;
  onViewDetail: () => void;
  onAction?: (action: BusinessRowAction) => void;
};

export function UserRowActions({
  derivedStatus,
  onViewDetail,
  onAction,
}: UserRowActionsProps) {
  const t = useTranslations("admin.users.actions");
  const actions = onAction ? availableActions(derivedStatus) : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={t("open")}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onViewDetail();
          }}
        >
          {t("viewDetail")}
        </DropdownMenuItem>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            variant={
              action === "reject" || action === "suspend"
                ? "destructive"
                : "default"
            }
            onSelect={(event) => {
              event.preventDefault();
              onAction?.(action);
            }}
          >
            {t(action)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
