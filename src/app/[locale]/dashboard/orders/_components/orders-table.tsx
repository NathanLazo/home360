"use client";

import {
  ClipboardListIcon,
  LoaderCircleIcon,
  PackageIcon,
  WrenchIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { OrderStatusBadge } from "./order-status-badge";
import type { OrderListItem } from "./order.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function OrdersTable({
  orders,
  filtered,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: {
  orders: OrderListItem[];
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (order: OrderListItem) => void;
}) {
  const t = useTranslations("dashboard.orders");
  const statusT = useTranslations("dashboard.orderStatus");
  const formatter = useFormatter();
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const columns: Array<DataTableColumn<OrderListItem>> = [
    {
      key: "folio",
      header: t("columns.folio"),
      className: "w-24",
      cell: (order) => (
        <span className="font-mono font-semibold tabular-nums">
          #{order.folio}
        </span>
      ),
    },
    {
      key: "title",
      header: t("columns.order"),
      className: "min-w-56",
      cell: (order) => <span className="font-medium">{order.title}</span>,
    },
    {
      key: "type",
      header: t("columns.type"),
      cell: (order) => (
        <Badge variant="secondary" className="gap-1.5">
          {order.type === "SERVICE" ? (
            <WrenchIcon aria-hidden="true" />
          ) : (
            <PackageIcon aria-hidden="true" />
          )}
          {t(order.type === "SERVICE" ? "types.service" : "types.product")}
        </Badge>
      ),
    },
    {
      key: "customer",
      header: t("columns.customer"),
      className: "min-w-40",
      cell: (order) => (
        <span className="text-muted-foreground">
          {order.customerName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "branch",
      header: t("columns.branch"),
      className: "min-w-36",
      cell: (order) => (
        <span className="text-muted-foreground">
          {order.branchName ?? t("noBranch")}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("columns.amount"),
      className: "text-right",
      cell: (order) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(order.amountCents)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (order) => (
        <OrderStatusBadge status={order.status} label={statusT(order.status)} />
      ),
    },
    {
      key: "date",
      header: t("columns.date"),
      className: "min-w-32",
      cell: (order) => (
        <time
          dateTime={order.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm tabular-nums"
        >
          {formatter.dateTime(order.createdAt, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </time>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={orders}
          onRowClick={onSelect}
          getRowId={(order) => order.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={ClipboardListIcon}
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
