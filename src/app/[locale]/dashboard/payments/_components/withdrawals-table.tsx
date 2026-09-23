"use client";

import { BanknoteArrowDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WithdrawalListItem } from "./payment.types";
import { PaymentsLoadMore } from "./payments-panel-states";
import { useMoneyFormat } from "./use-money-format";
import { WithdrawalStatusBadge } from "./withdrawal-status-badge";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Card, CardContent } from "~/components/ui/card";

export function WithdrawalsTable({
  withdrawals,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  withdrawals: WithdrawalListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("dashboard.payments.withdrawals");
  const paymentsT = useTranslations("dashboard.payments");
  const { currency, dateTime } = useMoneyFormat();

  const columns: Array<DataTableColumn<WithdrawalListItem>> = [
    {
      key: "amount",
      header: t("columns.amount"),
      className: "text-right",
      cell: (withdrawal) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(withdrawal.amountCents)}
        </span>
      ),
    },
    {
      key: "destination",
      header: t("columns.destination"),
      className: "min-w-44",
      cell: (withdrawal) => (
        <span>
          {t("destination", {
            bank: withdrawal.bankName,
            last4: withdrawal.accountLast4,
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      className: "min-w-44",
      cell: (withdrawal) => (
        <span className="flex flex-col items-start gap-1">
          <WithdrawalStatusBadge
            status={withdrawal.status}
            label={t(`status.${withdrawal.status}`)}
          />
          {withdrawal.rejectionReason ? (
            <span className="text-muted-foreground text-copy-sm">
              {t("rejectionReason", { reason: withdrawal.rejectionReason })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "requested",
      header: t("columns.requested"),
      className: "min-w-36",
      cell: (withdrawal) => (
        <time
          dateTime={withdrawal.requestedAt.toISOString()}
          className="text-muted-foreground text-copy-sm"
        >
          {dateTime(withdrawal.requestedAt)}
        </time>
      ),
    },
    {
      key: "processed",
      header: t("columns.processed"),
      className: "min-w-36",
      cell: (withdrawal) =>
        withdrawal.resolvedAt ? (
          <time
            dateTime={withdrawal.resolvedAt.toISOString()}
            className="text-muted-foreground text-copy-sm"
          >
            {dateTime(withdrawal.resolvedAt)}
          </time>
        ) : (
          <span className="text-muted-foreground text-copy-sm">
            {paymentsT("notAvailable")}
          </span>
        ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={withdrawals}
          getRowId={(withdrawal) => withdrawal.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={BanknoteArrowDownIcon}
                title={t("empty.title")}
                description={t("empty.description")}
              />
            </div>
          }
        />
      </CardContent>
      {hasMore ? (
        <PaymentsLoadMore loading={loadingMore} onLoadMore={onLoadMore} />
      ) : null}
    </Card>
  );
}
