"use client";

import { HandCoinsIcon, LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { OfferRowActions } from "./offer-row-actions";
import { OfferStatusBadge } from "./offer-status-badge";
import type { MyQuoteItem } from "./order.types";
import { useMoney } from "./use-money";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function OffersTable({
  quotes,
  filtered,
  hasMore,
  loadingMore,
  withdrawing,
  onLoadMore,
  onOpenRequest,
  onWithdraw,
}: {
  quotes: MyQuoteItem[];
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  withdrawing: boolean;
  onLoadMore: () => void;
  onOpenRequest: (requestId: string) => void;
  onWithdraw: (quoteId: string) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.requests.offers");
  const statusT = useTranslations("dashboard.requests.offerStatus");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());
  const money = useMoney();
  const columns: Array<DataTableColumn<MyQuoteItem>> = [
    {
      key: "request",
      mobile: "title",
      header: t("columns.request"),
      className: "min-w-56",
      cell: (quote) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">{quote.request.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {quote.request.neighborhood ?? quote.request.category}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      mobile: "trailing",
      header: t("columns.amount"),
      className: "text-right",
      cell: (quote) => (
        <span className="block font-mono font-semibold tabular-nums">
          {money(quote.amountCents)}
        </span>
      ),
    },
    {
      key: "scheduled",
      mobile: "meta",
      header: t("columns.scheduled"),
      className: "min-w-40",
      cell: (quote) =>
        quote.scheduledFor ? (
          <time
            dateTime={quote.scheduledFor.toISOString()}
            className="text-copy-sm tabular-nums"
          >
            {formatter.dateTime(quote.scheduledFor, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        ) : (
          <span className="text-muted-foreground">{t("notAvailable")}</span>
        ),
    },
    {
      key: "worker",
      mobile: "meta",
      header: t("columns.worker"),
      className: "min-w-36",
      cell: (quote) => (
        <span className="text-muted-foreground">
          {quote.workerName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "status",
      mobile: "status",
      header: t("columns.status"),
      cell: (quote) => (
        <OfferStatusBadge status={quote.status} label={statusT(quote.status)} />
      ),
    },
    {
      key: "updated",
      mobile: "meta",
      header: t("columns.updated"),
      className: "min-w-32",
      cell: (quote) => (
        <time
          dateTime={quote.updatedAt.toISOString()}
          className="text-muted-foreground text-copy-sm tabular-nums"
        >
          {formatter.relativeTime(quote.updatedAt, now)}
        </time>
      ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (quote) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <OfferRowActions
            quote={quote}
            withdrawing={withdrawing}
            onOpenRequest={onOpenRequest}
            onWithdraw={onWithdraw}
          />
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={quotes}
          onRowClick={(quote) => onOpenRequest(quote.request.id)}
          getRowId={(quote) => quote.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={HandCoinsIcon}
                title={t(filtered ? "empty.filteredTitle" : "empty.title")}
                description={t(
                  filtered ? "empty.filteredDescription" : "empty.description",
                )}
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
