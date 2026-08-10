"use client";

import { BuildingIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { BusinessStatusBadge } from "./business-status-badge";
import { GuaranteeBadge } from "./guarantee-badge";
import { UserRowActions, type BusinessRowAction } from "./user-row-actions";
import type { BusinessRow } from "./users.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

/** Initials are pure presentation, so they are derived in the UI. */
function toInitials(name: string): string {
  return name
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export type BusinessesTableProps = {
  businesses: BusinessRow[];
  onOpenBusiness: (businessId: string) => void;
  onAction?: (businessId: string, action: BusinessRowAction) => void;
};

export function BusinessesTable({
  businesses,
  onOpenBusiness,
  onAction,
}: BusinessesTableProps) {
  const t = useTranslations("admin.users");
  const typesT = useTranslations("admin.businessTypes");
  const formatter = useFormatter();
  // Frozen on mount so every relative date is measured against one instant.
  const [now] = useState(() => new Date());

  const columns: Array<DataTableColumn<BusinessRow>> = [
    {
      key: "name",
      header: t("columns.business"),
      className: "min-w-56",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs font-medium">
              {toInitials(row.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {typesT(row.type)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "guarantee",
      header: t("columns.guarantee"),
      cell: (row) => <GuaranteeBadge guaranteeType={row.guaranteeType} />,
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
      key: "status",
      header: t("columns.status"),
      cell: (row) => <BusinessStatusBadge status={row.derivedStatus} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <UserRowActions
          derivedStatus={row.derivedStatus}
          onViewDetail={() => onOpenBusiness(row.id)}
          onAction={
            onAction ? (action) => onAction(row.id, action) : undefined
          }
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={businesses}
      onRowClick={(row) => onOpenBusiness(row.id)}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={BuildingIcon}
            title={t("empty.businesses.title")}
            description={t("empty.businesses.description")}
          />
        </div>
      }
    />
  );
}
