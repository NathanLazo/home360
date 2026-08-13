"use client";

import { Building2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  CorporateRowActions,
  type CorporateRowAction,
} from "./corporate-row-actions";
import { CorporateStatusBadge } from "./corporate-status-badge";
import { CorporateTierBadge } from "./corporate-tier-badge";
import type { CorporateAccountRow } from "./corporate.types";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";

export type CorporateAccountsTableProps = {
  accounts: CorporateAccountRow[];
  onOpenAccount: (accountId: string) => void;
  onAction: (account: CorporateAccountRow, action: CorporateRowAction) => void;
  emptyAction?: React.ReactNode;
};

export function CorporateAccountsTable({
  accounts,
  onOpenAccount,
  onAction,
  emptyAction,
}: CorporateAccountsTableProps) {
  const t = useTranslations("admin.corporate");
  const currency = useCurrencyFormatter();

  const columns: Array<DataTableColumn<CorporateAccountRow>> = [
    {
      key: "account",
      header: t("columns.account"),
      className: "min-w-56",
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {row.ownerEmail ?? t("notAvailable")}
          </span>
        </div>
      ),
    },
    {
      key: "tier",
      header: t("columns.tier"),
      cell: (row) => <CorporateTierBadge tier={row.tier} />,
    },
    {
      key: "locations",
      header: t("columns.locations"),
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.maxLocations === null
            ? t("locationsCellUnlimited", { active: row.activeLocations })
            : t("locationsCell", {
                active: row.activeLocations,
                max: row.maxLocations,
              })}
        </span>
      ),
    },
    {
      key: "monthSpend",
      header: <span className="block text-right">{t("columns.monthSpend")}</span>,
      className: "text-right",
      cell: (row) => (
        <span className="font-mono text-sm font-medium tabular-nums">
          {currency(row.monthSpendCents)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <CorporateStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <CorporateRowActions
          status={row.status}
          onViewDetail={() => onOpenAccount(row.id)}
          onAction={(action) => onAction(row, action)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={accounts}
      onRowClick={(row) => onOpenAccount(row.id)}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Building2Icon}
            title={t("empty.title")}
            description={t("empty.description")}
            action={emptyAction}
          />
        </div>
      }
    />
  );
}
