"use client";

import { CopyIcon, EllipsisIcon, EyeIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TransactionListItem } from "./payment.types";
import { useCopyPaymentLink } from "./use-copy-payment-link";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Link } from "~/i18n/navigation";

/** Read-only actions: none of them mutate, so read-only plans keep them. */
export function TransactionRowActions({
  transaction,
  onViewDetail,
}: {
  transaction: TransactionListItem;
  onViewDetail: (transaction: TransactionListItem) => void;
}) {
  const t = useTranslations("dashboard.payments.rowActions");
  const copyPaymentLink = useCopyPaymentLink();
  const concept =
    transaction.concept.length > 0 ? transaction.concept : transaction.id;

  return (
    // The row itself is clickable; the menu must not also open the sheet.
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("open", { concept })}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onViewDetail(transaction)}>
            <EyeIcon aria-hidden="true" />
            {t("viewDetail")}
          </DropdownMenuItem>
          {transaction.orderId ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/orders?order=${transaction.orderId}`}>
                <ReceiptTextIcon aria-hidden="true" />
                {t("goToOrder")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {transaction.paymentLinkUrl ? (
            <DropdownMenuItem
              onSelect={() => {
                if (transaction.paymentLinkUrl) {
                  void copyPaymentLink(transaction.paymentLinkUrl);
                }
              }}
            >
              <CopyIcon aria-hidden="true" />
              {t("copyLink")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
