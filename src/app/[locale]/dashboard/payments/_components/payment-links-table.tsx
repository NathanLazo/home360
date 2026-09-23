"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PaymentLinkRowActions } from "./payment-link-row-actions";
import { PaymentLinkStatusBadge } from "./payment-link-status-badge";
import type { PaymentLinkListItem } from "./payment.types";
import { PaymentsLoadMore } from "./payments-panel-states";
import { useMoneyFormat } from "./use-money-format";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function PaymentLinksTable({
  paymentLinks,
  hasMore,
  loadingMore,
  onLoadMore,
  onCreate,
}: {
  paymentLinks: PaymentLinkListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations("dashboard.payments.paymentLinks");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const { currency, dateTime } = useMoneyFormat();

  const columns: Array<DataTableColumn<PaymentLinkListItem>> = [
    {
      key: "concept",
      header: t("columns.concept"),
      className: "min-w-56",
      cell: (link) => <span className="font-medium">{link.concept}</span>,
    },
    {
      key: "amount",
      header: t("columns.amount"),
      className: "text-right",
      cell: (link) => (
        <span className="flex flex-col items-end">
          <span className="font-mono font-semibold tabular-nums">
            {currency(link.amountCents)}
          </span>
          <span className="text-muted-foreground text-label font-mono tabular-nums">
            {t("customerPays", { amount: currency(link.totalCents) })}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (link) => (
        <PaymentLinkStatusBadge
          status={link.status}
          label={t(`status.${link.status}`)}
        />
      ),
    },
    {
      key: "created",
      header: t("columns.created"),
      className: "min-w-36",
      cell: (link) => (
        <time
          dateTime={link.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm"
        >
          {dateTime(link.createdAt)}
        </time>
      ),
    },
    {
      key: "paid",
      header: t("columns.paid"),
      className: "min-w-36",
      cell: (link) =>
        link.paidAt ? (
          <time
            dateTime={link.paidAt.toISOString()}
            className="text-copy-sm font-medium"
          >
            {dateTime(link.paidAt)}
          </time>
        ) : (
          <span className="text-muted-foreground text-copy-sm">
            {t("unpaid")}
          </span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (link) => <PaymentLinkRowActions paymentLink={link} />,
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={paymentLinks}
          getRowId={(link) => link.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={LinkIcon}
                title={t("empty.title")}
                description={t("empty.description")}
                action={
                  <Button
                    type="button"
                    disabled={isReadOnly}
                    title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
                    onClick={onCreate}
                  >
                    <LinkIcon aria-hidden="true" />
                    {t("empty.action")}
                  </Button>
                }
              />
            </div>
          }
        />
      </CardContent>
      {hasMore ? (
        <PaymentsLoadMore loading={loadingMore} onLoadMore={onLoadMore} />
      ) : null}
    </Card>
  );
}
