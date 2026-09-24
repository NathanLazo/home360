"use client";

import { useState } from "react";
import { FilterXIcon, ReceiptTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PaymentStatusBadge } from "./payment-status-badge";
import type { TransactionListItem } from "./payment.types";
import { PaymentsLoadMore } from "./payments-panel-states";
import { TransactionRowActions } from "./transaction-row-actions";
import { useMoneyFormat } from "./use-money-format";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function TransactionsTable({
  transactions,
  filtered,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
  onClearFilters,
}: {
  transactions: TransactionListItem[];
  /** Whether a filter or branch scope is narrowing the list. */
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (transaction: TransactionListItem) => void;
  onClearFilters: () => void;
}) {
  const t = useTranslations("dashboard.payments");
  const statusT = useTranslations("dashboard.payments.status");
  const methodT = useTranslations("dashboard.payments.methods");
  const formatter = useFormatter();
  const { currency } = useMoneyFormat();
  // Frozen on mount so every relative date in the table is measured against
  // the same instant and re-renders stay stable.
  const [now] = useState(() => new Date());

  const columns: Array<DataTableColumn<TransactionListItem>> = [
    {
      key: "customer",
      mobile: "title",
      header: t("columns.customer"),
      className: "min-w-40",
      cell: (transaction) => (
        <span className="font-medium">
          {transaction.customerName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "concept",
      mobile: "subtitle",
      header: t("columns.concept"),
      className: "min-w-56",
      cell: (transaction) => (
        <span className="text-muted-foreground">
          {transaction.concept.length > 0
            ? transaction.concept
            : t("noConcept")}
        </span>
      ),
    },
    {
      key: "amount",
      mobile: "trailing",
      header: t("columns.amount"),
      className: "text-right",
      cell: (transaction) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(transaction.amountCents)}
        </span>
      ),
    },
    {
      key: "method",
      mobile: "meta",
      header: t("columns.method"),
      cell: (transaction) => (
        <Badge variant="secondary">{methodT(transaction.method)}</Badge>
      ),
    },
    {
      key: "status",
      mobile: "status",
      header: t("columns.status"),
      cell: (transaction) => (
        <PaymentStatusBadge
          status={transaction.status}
          label={statusT(transaction.status)}
        />
      ),
    },
    {
      key: "date",
      mobile: "meta",
      header: t("columns.date"),
      className: "min-w-32",
      cell: (transaction) => (
        <time
          dateTime={transaction.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(transaction.createdAt, now)}
        </time>
      ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (transaction) => (
        <TransactionRowActions
          transaction={transaction}
          onViewDetail={onSelect}
        />
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={transactions}
          getRowId={(transaction) => transaction.id}
          onRowClick={onSelect}
          emptyState={
            <div className="p-4 sm:p-6">
              {filtered ? (
                <EmptyState
                  icon={FilterXIcon}
                  title={t("emptyFiltered.title")}
                  description={t("emptyFiltered.description")}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClearFilters}
                    >
                      {t("filters.clear")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ReceiptTextIcon}
                  title={t("empty.title")}
                  description={t("empty.description")}
                />
              )}
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
