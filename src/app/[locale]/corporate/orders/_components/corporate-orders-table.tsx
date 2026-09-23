"use client";

import { InboxIcon, LoaderCircleIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateOrderStatusBadge } from "../../_components/corporate-order-status-badge";
import type { CorporateOrderItem } from "../../_components/corporate.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export type CorporateOrdersTableProps = {
  orders: CorporateOrderItem[];
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (order: CorporateOrderItem) => void;
};

export function CorporateOrdersTable({
  orders,
  filtered,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: CorporateOrdersTableProps) {
  const t = useTranslations("corporate.orders");
  const statusT = useTranslations("corporate.orderStatus");
  const formatter = useFormatter();

  const columns: Array<DataTableColumn<CorporateOrderItem>> = [
    {
      key: "folio",
      header: t("table.folio"),
      cell: (order) => (
        <span className="font-mono text-xs tabular-nums">#{order.folio}</span>
      ),
    },
    {
      key: "order",
      header: t("table.order"),
      cell: (order) => (
        <span className="block max-w-56 truncate font-medium">
          {order.title}
        </span>
      ),
    },
    {
      key: "business",
      header: t("table.business"),
      cell: (order) => (
        <span className="block max-w-44 truncate">{order.businessName}</span>
      ),
    },
    {
      key: "location",
      header: t("table.location"),
      cell: (order) =>
        order.location ? (
          <span className="block max-w-40 truncate">{order.location.name}</span>
        ) : (
          <span className="text-muted-foreground">{t("table.noLocation")}</span>
        ),
    },
    {
      key: "amount",
      header: t("table.amount"),
      className: "text-right",
      cell: (order) => (
        <span className="font-mono tabular-nums">
          {formatter.number(order.amountCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: t("table.status"),
      cell: (order) => (
        <CorporateOrderStatusBadge
          status={order.status}
          label={statusT(order.status)}
        />
      ),
    },
    {
      key: "date",
      header: t("table.date"),
      cell: (order) => (
        <time
          dateTime={order.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm tabular-nums"
        >
          {formatter.dateTime(order.createdAt, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </time>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0" aria-label={t("table.label")}>
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={orders}
          onRowClick={onSelect}
          getRowId={(order) => order.id}
          emptyState={
            <div className="p-4 sm:p-6">
              {filtered ? (
                <EmptyState
                  icon={SearchXIcon}
                  title={t("filteredEmptyTitle")}
                  description={t("filteredEmptyDescription")}
                />
              ) : (
                <EmptyState
                  icon={InboxIcon}
                  title={t("emptyTitle")}
                  description={t("emptyDescription")}
                />
              )}
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
            onClick={onLoadMore}
            disabled={loadingMore}
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
