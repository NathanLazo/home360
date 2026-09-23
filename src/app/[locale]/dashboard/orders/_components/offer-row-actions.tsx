"use client";

import { useState } from "react";
import {
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  ReceiptTextIcon,
  Undo2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { MyQuoteItem } from "./order.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Link } from "~/i18n/navigation";

/**
 * Row menu of "Mis ofertas": view the request, edit/re-send (opens the same
 * request sheet with the offer form prefilled), withdraw a pending offer or
 * jump to the resulting order once accepted.
 */
export function OfferRowActions({
  quote,
  withdrawing,
  onOpenRequest,
  onWithdraw,
}: {
  quote: MyQuoteItem;
  withdrawing: boolean;
  onOpenRequest: (requestId: string) => void;
  onWithdraw: (quoteId: string) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.requests.offers.actions");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyTitle = isReadOnly ? readOnlyT("actionDisabled") : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requestOpen =
    quote.request.status === "OPEN" || quote.request.status === "QUOTED";
  const editable =
    requestOpen && (quote.status === "PENDING" || quote.status === "WITHDRAWN");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("open", { title: quote.request.title })}
            disabled={withdrawing}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onOpenRequest(quote.request.id)}>
            <EyeIcon aria-hidden="true" />
            {t("view")}
          </DropdownMenuItem>
          {editable ? (
            <DropdownMenuItem
              onSelect={() => onOpenRequest(quote.request.id)}
              disabled={isReadOnly}
              title={readOnlyTitle}
            >
              <PencilIcon aria-hidden="true" />
              {t(quote.status === "WITHDRAWN" ? "resend" : "edit")}
            </DropdownMenuItem>
          ) : null}
          {quote.order ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/orders?order=${quote.order.id}`}>
                <ReceiptTextIcon aria-hidden="true" />
                {t("viewOrder", { folio: quote.order.folio })}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {quote.status === "PENDING" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmOpen(true)}
                disabled={isReadOnly}
                title={readOnlyTitle}
              >
                <Undo2Icon aria-hidden="true" />
                {t("withdraw")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("withdrawDialog.title")}
        description={t("withdrawDialog.description", {
          title: quote.request.title,
        })}
        confirmLabel={t("withdrawDialog.confirm")}
        cancelLabel={t("withdrawDialog.cancel")}
        destructive
        loading={withdrawing}
        onConfirm={() =>
          void onWithdraw(quote.id).then((done) => {
            if (done) setConfirmOpen(false);
          })
        }
      />
    </>
  );
}
