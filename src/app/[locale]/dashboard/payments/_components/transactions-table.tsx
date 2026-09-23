"use client";

import { useState } from "react";
import { LoaderCircleIcon, ReceiptTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PaymentStatusBadge } from "./payment-status-badge";
import type { TransactionListItem } from "./payment.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function TransactionsTable({
  transactions,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  transactions: TransactionListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("dashboard.payments");
  const statusT = useTranslations("dashboard.payments.status");
  const methodT = useTranslations("dashboard.payments.methods");
  const formatter = useFormatter();
  // Frozen on mount so every relative date in the table is measured against
  // the same instant and re-renders stay stable.
  const [now] = useState(() => new Date());
  // Only division allowed on the client: it is currency formatting, not money
  // math. `amountCents` is already the server-side total.
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const columns: Array<DataTableColumn<TransactionListItem>> = [
    {
      key: "customer",
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
      header: t("columns.method"),
      cell: (transaction) => (
        <Badge variant="secondary">{methodT(transaction.method)}</Badge>
      ),
    },
    {
      key: "status",
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
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={transactions}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={ReceiptTextIcon}
                title={t("empty.title")}
                description={t("empty.description")}
              />
            </div>
          }
        />
      </CardContent>
      {hasMore ? (
        <div className="flex justify-center border-t p-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
