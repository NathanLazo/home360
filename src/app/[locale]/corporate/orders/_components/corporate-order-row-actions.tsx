"use client";

import {
  BadgeCheckIcon,
  EllipsisIcon,
  EyeIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { CorporateOrderItem } from "../../_components/corporate.types";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/** States where the escrow still holds the payment (confirm / dispute). */
const ESCROW_STATUSES: ReadonlyArray<CorporateOrderItem["status"]> = [
  "PAID",
  "IN_PROGRESS",
  "SHIPPING",
];

export type CorporateOrderRowActionsProps = {
  order: CorporateOrderItem;
  busy: boolean;
  onView: (orderId: string) => void;
  onConfirm: (orderId: string) => void;
  onDispute: (orderId: string) => void;
  onCancel: (orderId: string) => void;
};

/**
 * Row menu of the consolidated orders table. Entries follow the list status;
 * the server re-validates every guard (e.g. confirmation requires the work
 * to be marked done) and answers a translated error otherwise.
 */
export function CorporateOrderRowActions({
  order,
  busy,
  onView,
  onConfirm,
  onDispute,
  onCancel,
}: CorporateOrderRowActionsProps) {
  const t = useTranslations("corporate.orders.actions");
  const inEscrow = ESCROW_STATUSES.includes(order.status);
  const unpaid = order.status === "PENDING";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-10 min-w-10"
          aria-label={t("open", { folio: order.folio })}
          disabled={busy}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <EllipsisIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      {/* React events bubble through the portal to the clickable row. */}
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onSelect={() => onView(order.id)}>
          <EyeIcon aria-hidden="true" />
          {t("view")}
        </DropdownMenuItem>
        {inEscrow || unpaid ? <DropdownMenuSeparator /> : null}
        {inEscrow ? (
          <>
            <DropdownMenuItem onSelect={() => onConfirm(order.id)}>
              <BadgeCheckIcon aria-hidden="true" />
              {t("confirm")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDispute(order.id)}>
              <ShieldAlertIcon aria-hidden="true" />
              {t("dispute")}
            </DropdownMenuItem>
          </>
        ) : null}
        {unpaid ? (
          <DropdownMenuItem
            className="text-error-deep focus:text-error-deep"
            onSelect={() => onCancel(order.id)}
          >
            <XCircleIcon aria-hidden="true" />
            {t("cancel")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
