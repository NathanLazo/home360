"use client";

import type { ReactNode } from "react";
import { CopyIcon, ReceiptTextIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PaymentStatusBadge } from "./payment-status-badge";
import type { TransactionListItem } from "./payment.types";
import { useCopyPaymentLink } from "./use-copy-payment-link";
import { useMoneyFormat } from "./use-money-format";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Link } from "~/i18n/navigation";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-copy-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function Amount({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

/**
 * Detail of one transaction, rendered from the already loaded list row: the
 * list projection carries every ledger snapshot (commission, refunds, net),
 * so no per-payment endpoint is needed. Figures are server-derived.
 */
export function TransactionDetailSheet({
  open,
  transaction,
  onOpenChange,
}: {
  open: boolean;
  /** Kept after closing so the exit animation never shows an empty sheet. */
  transaction: TransactionListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.payments.detail");
  const paymentsT = useTranslations("dashboard.payments");
  const statusT = useTranslations("dashboard.payments.status");
  const methodT = useTranslations("dashboard.payments.methods");
  const { currency, dateTime } = useMoneyFormat();
  const copyPaymentLink = useCopyPaymentLink();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="pr-14">
          <SheetTitle>
            {transaction && transaction.concept.length > 0
              ? transaction.concept
              : t("title")}
          </SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t("close")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {transaction ? (
          <>
            <dl className="flex flex-col gap-3 px-4">
              <DetailRow label={t("status")}>
                <PaymentStatusBadge
                  status={transaction.status}
                  label={statusT(transaction.status)}
                />
              </DetailRow>
              <DetailRow label={t("customer")}>
                {transaction.customerName ?? paymentsT("notAvailable")}
              </DetailRow>
              <DetailRow label={t("method")}>
                {methodT(transaction.method)}
              </DetailRow>
              <DetailRow label={t("order")}>
                {transaction.orderFolio !== null ? (
                  <span className="font-mono tabular-nums">
                    {t("orderFolio", { folio: transaction.orderFolio })}
                  </span>
                ) : (
                  paymentsT("notAvailable")
                )}
              </DetailRow>
              <DetailRow label={t("branch")}>
                {transaction.branchName ?? t("noBranch")}
              </DetailRow>
            </dl>

            <Separator className="mx-4 w-auto" />

            <dl className="flex flex-col gap-3 px-4">
              <DetailRow label={t("total")}>
                <Amount>{currency(transaction.amountCents)}</Amount>
              </DetailRow>
              <DetailRow label={t("providerAmount")}>
                <Amount>{currency(transaction.providerAmountCents)}</Amount>
              </DetailRow>
              <DetailRow label={t("serviceFee")}>
                <Amount>{currency(transaction.serviceFeeCents)}</Amount>
              </DetailRow>
              <DetailRow
                label={t("commission", { percent: transaction.commissionPct })}
              >
                <Amount>−{currency(transaction.commissionCents)}</Amount>
              </DetailRow>
              <DetailRow label={t("refunded")}>
                <Amount>
                  {transaction.refundedCents > 0
                    ? `−${currency(transaction.refundedCents)}`
                    : currency(0)}
                </Amount>
              </DetailRow>
              <DetailRow label={t("net")}>
                <span className="font-mono font-semibold tabular-nums">
                  {currency(transaction.netAmountCents)}
                </span>
              </DetailRow>
            </dl>

            <Separator className="mx-4 w-auto" />

            <dl className="flex flex-col gap-3 px-4">
              <DetailRow label={t("createdAt")}>
                <time dateTime={transaction.createdAt.toISOString()}>
                  {dateTime(transaction.createdAt)}
                </time>
              </DetailRow>
              <DetailRow label={t("escrowReleaseAt")}>
                {transaction.escrowReleaseAt ? (
                  <time dateTime={transaction.escrowReleaseAt.toISOString()}>
                    {dateTime(transaction.escrowReleaseAt)}
                  </time>
                ) : (
                  t("notScheduled")
                )}
              </DetailRow>
              <DetailRow label={t("releasedAt")}>
                {transaction.releasedAt ? (
                  <time dateTime={transaction.releasedAt.toISOString()}>
                    {dateTime(transaction.releasedAt)}
                  </time>
                ) : (
                  paymentsT("notAvailable")
                )}
              </DetailRow>
            </dl>

            <SheetFooter className="flex-col gap-2 sm:flex-col">
              {transaction.orderId ? (
                <Button asChild>
                  <Link href={`/dashboard/orders?order=${transaction.orderId}`}>
                    <ReceiptTextIcon aria-hidden="true" />
                    {t("viewOrder")}
                  </Link>
                </Button>
              ) : null}
              {transaction.paymentLinkUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (transaction.paymentLinkUrl) {
                      void copyPaymentLink(transaction.paymentLinkUrl);
                    }
                  }}
                >
                  <CopyIcon aria-hidden="true" />
                  {t("copyLink")}
                </Button>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
