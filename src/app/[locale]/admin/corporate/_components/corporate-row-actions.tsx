"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CorporateStatusValue } from "./corporate.schema";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type CorporateRowAction =
  "activate" | "editTerms" | "suspend" | "reactivate" | "reconcileBilling";

/**
 * Single source of truth for what each lifecycle state may offer. CANCELLED is
 * read-only on purpose: that state belongs to the Stripe webhook (F7-07) and
 * the panel never fakes a way back from it.
 *
 * `reconcileBilling` shows on ACTIVE and PENDING: the list row cannot tell
 * whether a PENDING account already has a membership, so the server answers
 * CONFLICT (translated) when there is nothing to reconcile yet.
 */
export function availableCorporateActions(
  status: CorporateStatusValue,
): CorporateRowAction[] {
  switch (status) {
    case "PENDING":
      return ["activate", "editTerms", "reconcileBilling"];
    case "ACTIVE":
      return ["editTerms", "reconcileBilling", "suspend"];
    case "SUSPENDED":
      return ["editTerms", "reactivate"];
    case "CANCELLED":
      return [];
  }
}

export type CorporateRowActionsProps = {
  status: CorporateStatusValue;
  onViewDetail: () => void;
  onAction: (action: CorporateRowAction) => void;
  /** Opens the corporate panel as its owner (read-only). */
  onImpersonate?: () => void;
};

export function CorporateRowActions({
  status,
  onViewDetail,
  onAction,
  onImpersonate,
}: CorporateRowActionsProps) {
  const t = useTranslations("admin.corporate.actions");
  const impersonationT = useTranslations("admin.impersonation");
  const actions = availableCorporateActions(status);

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
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onViewDetail();
          }}
        >
          {t("viewDetail")}
        </DropdownMenuItem>
        {onImpersonate ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onImpersonate();
            }}
          >
            {impersonationT("viewPanel")}
          </DropdownMenuItem>
        ) : null}
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            variant={action === "suspend" ? "destructive" : "default"}
            onSelect={(event) => {
              event.preventDefault();
              onAction(action);
            }}
          >
            {t(action)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
