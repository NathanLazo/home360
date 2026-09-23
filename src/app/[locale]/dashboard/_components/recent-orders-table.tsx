"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { InboxIcon, RotateCcwIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { RecentOrder } from "./dashboard.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { TableSkeleton } from "~/components/table-skeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "~/i18n/navigation";
import { api } from "~/trpc/react";

export type RecentOrdersTableProps = {
  branchId?: string;
};

const statusVariantMap = {
  PENDING: "warning",
  PAID: "info",
  IN_PROGRESS: "info",
  SHIPPING: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
} satisfies Record<RecentOrder["status"], StatusBadgeVariant>;

export function RecentOrdersTable({ branchId }: RecentOrdersTableProps) {
  const t = useTranslations("dashboard.home");
  const status = useTranslations("dashboard.orderStatus");
  const errors = useTranslations("errors");
  const formatter = useFormatter();
  const input = branchId ? { branchId } : {};
  const query = api.dashboard.getRecentOrders.useQuery(input, {
    placeholderData: keepPreviousData,
  });
  const response = query.data;
  const ordersHref = branchId
    ? `/dashboard/orders?branch=${encodeURIComponent(branchId)}`
    : "/dashboard/orders";

  if (query.isPending) {
    return (
      <Card className="overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-4 border-b py-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="px-0">
          <TableSkeleton columns={6} label={t("loadingOrders")} />
        </CardContent>
      </Card>
    );
  }

  if (query.error || !response || response.error || !response.result) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>
            <h2>{t("recentOrdersTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("queryErrorTitle")}</p>
            <p className="text-muted-foreground text-copy-sm">
              {response?.error
                ? errors(response.error)
                : t("queryErrorDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            onClick={() => void query.refetch()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = response.result;
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const columns: Array<DataTableColumn<RecentOrder>> = [
    {
      key: "folio",
      header: t("folioColumn"),
      className: "w-24",
      cell: (row) => (
        <span className="font-mono font-semibold tabular-nums">
          #{row.folio}
        </span>
      ),
    },
    {
      key: "title",
      header: t("orderColumn"),
      className: "min-w-52",
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "customer",
      header: t("customerColumn"),
      className: "min-w-40",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.customerName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "branch",
      header: t("branchColumn"),
      className: "min-w-36",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.branchName ?? t("noBranch")}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("amountColumn"),
      className: "text-right",
      cell: (row) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(row.amountCents)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("statusColumn"),
      cell: (row) => (
        <StatusBadge
          status={row.status}
          variantMap={statusVariantMap}
          label={status(row.status)}
        />
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b py-4">
        <CardTitle>
          <h2>{t("recentOrdersTitle")}</h2>
        </CardTitle>
        <Button
          variant="link"
          size="sm"
          asChild
          className="min-h-11 px-0 sm:min-h-10"
        >
          <Link href={ordersHref}>{t("viewAll")}</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={data}
          getRowId={(row) => row.id}
          emptyState={
            <div className="p-6">
              <EmptyState
                headingLevel="h3"
                icon={InboxIcon}
                title={t("ordersEmptyTitle")}
                description={t("ordersEmptyDescription")}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
