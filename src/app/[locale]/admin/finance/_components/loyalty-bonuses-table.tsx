"use client";

import { GiftIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { LoyaltyBonusRow } from "./finance.types";
import { LoyaltyBonusRowActions } from "./loyalty-bonus-row-actions";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const statusVariants: Record<LoyaltyBonusRow["status"], StatusBadgeVariant> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "muted",
};

export function LoyaltyBonusesTable({
  bonuses,
  onPay,
  onCancel,
}: {
  bonuses: LoyaltyBonusRow[];
  onPay: (bonus: LoyaltyBonusRow) => void;
  onCancel: (bonus: LoyaltyBonusRow) => void;
}) {
  const t = useTranslations("admin.finance.loyalty");
  const statusT = useTranslations("admin.loyaltyBonusStatus");
  const methodT = useTranslations("admin.loyaltyPayoutMethod");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());

  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const columns: Array<DataTableColumn<LoyaltyBonusRow>> = [
    {
      key: "business",
      header: t("columns.business"),
      className: "min-w-48",
      cell: (row) => <span className="font-medium">{row.business.name}</span>,
    },
    {
      key: "amount",
      header: t("columns.amount"),
      className: "text-right",
      cell: (row) => (
        <span className="font-mono font-semibold tabular-nums">
          {currency(row.amountCents)}
        </span>
      ),
    },
    {
      key: "origin",
      header: t("columns.origin"),
      cell: (row) => (
        <span className="text-muted-foreground text-copy-sm">
          {t("originValue", {
            amount: currency(row.payment.amountCents),
            pct: row.pctApplied,
          })}
        </span>
      ),
    },
    {
      key: "accruedAt",
      header: t("columns.accruedAt"),
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
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={row.status}
            variantMap={statusVariants}
            label={statusT(row.status)}
          />
          {row.method ? (
            <span className="text-muted-foreground text-xs">
              {methodT(row.method)}
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
        <LoyaltyBonusRowActions
          bonus={row}
          onPay={() => onPay(row)}
          onCancel={() => onCancel(row)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={bonuses}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={GiftIcon}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        </div>
      }
    />
  );
}
