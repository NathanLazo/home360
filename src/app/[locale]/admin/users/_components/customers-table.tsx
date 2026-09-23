"use client";

import type { ReactNode } from "react";
import { UsersIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { CustomerRowActions } from "./customer-row-actions";
import type { UserAccessAction } from "./user-access-dialogs";
import { UserAccessBadge } from "./user-access-badge";
import type { CustomerRow } from "./users.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { UserAvatar } from "~/components/user-avatar";

export function CustomersTable({
  customers,
  onOpenCustomer,
  onAccessAction,
  emptyAction,
}: {
  customers: CustomerRow[];
  onOpenCustomer: (customerId: string) => void;
  onAccessAction: (customerId: string, action: UserAccessAction) => void;
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
        <div className="flex items-center gap-3">
          <UserAvatar
            seed={row.id}
            name={row.name ?? t("unnamed")}
            state={row.accessStatus === "suspended" ? "sleeping" : "default"}
          />
          <span className="truncate font-medium">
            {row.name ?? t("unnamed")}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: t("columns.email"),
      cell: (row) => (
        <span className="text-muted-foreground text-copy-sm">
          {row.email ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "orders",
      header: t("columns.orders"),
      className: "text-right",
      cell: (row) => (
        <span className="text-copy-sm font-mono tabular-nums">
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
          className="text-muted-foreground text-copy-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(row.createdAt, now)}
        </time>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <UserAccessBadge status={row.accessStatus} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <CustomerRowActions
          accessStatus={row.accessStatus}
          onViewDetail={() => onOpenCustomer(row.id)}
          onAccessAction={(action) => onAccessAction(row.id, action)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      onRowClick={(row) => onOpenCustomer(row.id)}
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
