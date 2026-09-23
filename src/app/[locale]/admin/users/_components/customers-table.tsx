"use client";

import type { ReactNode } from "react";
import { UsersIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { CustomerRow } from "./users.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";

export function CustomersTable({
  customers,
  emptyAction,
}: {
  customers: CustomerRow[];
  emptyAction?: ReactNode;
}) {
  const t = useTranslations("admin.users");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());

  const columns: Array<DataTableColumn<CustomerRow>> = [
    {
      key: "name",
      header: t("columns.customer"),
      className: "min-w-48",
      cell: (row) => (
        <span className="font-medium">{row.name ?? t("unnamed")}</span>
      ),
    },
    {
      key: "email",
      header: t("columns.email"),
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
          {row.email ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "orders",
      header: t("columns.orders"),
      className: "text-right",
      cell: (row) => (
        <span className="font-mono text-sm tabular-nums">
          {row.ordersCount}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t("columns.registeredAt"),
      cell: (row) => (
        <time
          dateTime={row.createdAt.toISOString()}
          className="text-muted-foreground text-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(row.createdAt, now)}
        </time>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={UsersIcon}
            title={t("empty.customers.title")}
            description={t("empty.customers.description")}
            action={emptyAction}
          />
        </div>
      }
    />
  );
}
