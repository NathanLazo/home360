"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BusinessDerivedStatus } from "./users.schema";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Link } from "~/i18n/navigation";

export type BusinessRowAction =
  "approve" | "reject" | "suspend" | "reactivate" | "reopen";

/**
 * Visibility of the moderation entries by derived status: the single place
 * that decides what each state may offer (row menu and detail sheet alike).
 * A rejected business can only go back to the review queue.
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
      return ["reopen"];
  }
}

const DESTRUCTIVE_ACTIONS: ReadonlySet<BusinessRowAction> = new Set([
  "reject",
  "suspend",
]);

export type UserRowActionsProps = {
  derivedStatus: BusinessDerivedStatus;
  /** Oldest unresolved dispute; offers "view dispute" when present. */
  firstOpenDisputeId: string | null;
  onViewDetail: () => void;
  onReviewDocuments: () => void;
  onAction?: (action: BusinessRowAction) => void;
};

export function UserRowActions({
  derivedStatus,
  firstOpenDisputeId,
  onViewDetail,
  onReviewDocuments,
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
          aria-label={t("open")}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onViewDetail();
          }}
        >
          {t("viewDetail")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onReviewDocuments();
          }}
        >
          {t("reviewDocuments")}
        </DropdownMenuItem>
        {firstOpenDisputeId ? (
          <DropdownMenuItem asChild>
            <Link href={`/admin/disputes?dispute=${firstOpenDisputeId}`}>
              {t("viewDispute")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {actions.length > 0 ? <DropdownMenuSeparator /> : null}
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            variant={
              DESTRUCTIVE_ACTIONS.has(action) ? "destructive" : "default"
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
