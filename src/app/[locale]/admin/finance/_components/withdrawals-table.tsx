"use client";

import { BanknoteIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { WithdrawalRow } from "./finance.types";
import { WithdrawalRowActions } from "./withdrawal-row-actions";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { cn } from "~/lib/utils";

const statusVariants: Record<WithdrawalRow["status"], StatusBadgeVariant> = {
  REQUESTED: "warning",
  PROCESSING: "info",
  APPROVED: "success",
  REJECTED: "muted",
  FAILED: "destructive",
  CANCELED: "muted",
};

export function WithdrawalsTable({
  withdrawals,
  pending,
  onApprove,
  onReject,
}: {
  withdrawals: WithdrawalRow[];
  pending: boolean;
  onApprove: (withdrawalId: string) => void;
  onReject: (input: { withdrawalId: string; reason: string }) => void;
}) {
  const t = useTranslations("admin.finance.withdrawals");
  const statusT = useTranslations("admin.withdrawalStatus");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());

  const isSuspended = (row: WithdrawalRow) =>
    row.business.status === "SUSPENDED";

  const columns: Array<DataTableColumn<WithdrawalRow>> = [
    {
      key: "business",
      header: t("columns.business"),
      className: "min-w-48",
      cell: (row) => (
        <div className={cn("flex flex-col", isSuspended(row) && "opacity-60")}>
          <span className="font-medium">{row.business.name}</span>
          {isSuspended(row) ? (
            <span className="text-muted-foreground text-xs">
              {t("suspendedNote")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("columns.amount"),
      className: "text-right",
      cell: (row) => (
        <span className="font-mono font-semibold tabular-nums">
          {formatter.number(row.amountCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "destination",
      header: t("columns.destination"),
      cell: (row) => (
        <span className="text-muted-foreground font-mono text-sm">
          {row.bankName} ••••{row.accountLast4}
        </span>
      ),
    },
    {
      key: "requestedAt",
      header: t("columns.requestedAt"),
      cell: (row) => (
        <time
          dateTime={row.requestedAt.toISOString()}
          className="text-muted-foreground text-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(row.requestedAt, now)}
        </time>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={row.status}
            variantMap={statusVariants}
            label={statusT(row.status)}
          />
          {row.rejectionReason ? (
            <span className="text-muted-foreground max-w-48 truncate text-xs">
              {row.rejectionReason}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <WithdrawalRowActions
          withdrawal={row}
          pending={pending}
          onApprove={onApprove}
          onReject={onReject}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={withdrawals}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={BanknoteIcon}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        </div>
      }
    />
  );
}
