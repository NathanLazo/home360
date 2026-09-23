"use client";

import { useState } from "react";
import {
  BanIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { PaymentLinkListItem } from "./payment.types";
import { useCopyPaymentLink } from "./use-copy-payment-link";
import { usePaymentMutations } from "./use-payment-mutations";
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

export function PaymentLinkRowActions({
  paymentLink,
}: {
  paymentLink: PaymentLinkListItem;
}) {
  const t = useTranslations("dashboard.payments.paymentLinks");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  // The menu stays reachable on a read-only plan; only deactivation, the one
  // mutating entry, is blocked (the server enforces it too).
  const { isReadOnly } = useSubscriptionAccess();
  const copyPaymentLink = useCopyPaymentLink();
  const { deactivatePaymentLink, deactivatingPaymentLink } =
    usePaymentMutations();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const url = paymentLink.url;

  // Only a live link has something to share or switch off; paid, inactive
  // and still-creating rows are history without actions.
  if (paymentLink.status !== "ACTIVE" || url === null) {
    return null;
  }

  async function handleDeactivate() {
    if (await deactivatePaymentLink(paymentLink.id)) {
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.open", { concept: paymentLink.concept })}
            disabled={deactivatingPaymentLink}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void copyPaymentLink(url)}>
            <CopyIcon aria-hidden="true" />
            {t("actions.copy")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon aria-hidden="true" />
              {t("actions.openLink")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
            disabled={isReadOnly}
            title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
          >
            <BanIcon aria-hidden="true" />
            {t("actions.deactivate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!deactivatingPaymentLink) {
            setConfirmOpen(next);
          }
        }}
        title={t("deactivate.title")}
        description={t("deactivate.description", {
          concept: paymentLink.concept,
        })}
        confirmLabel={t("deactivate.confirm")}
        cancelLabel={t("deactivate.cancel")}
        destructive
        loading={deactivatingPaymentLink}
        onConfirm={() => void handleDeactivate()}
      />
    </>
  );
}
