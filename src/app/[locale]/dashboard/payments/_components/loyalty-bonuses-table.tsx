"use client";

import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { LoyaltyBonusStatusBadge } from "./loyalty-bonus-status-badge";
import type { LoyaltyBonusListItem } from "./payment.types";
import { PaymentsLoadMore } from "./payments-panel-states";
import { useMoneyFormat } from "./use-money-format";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Card, CardContent } from "~/components/ui/card";

export function LoyaltyBonusesTable({
  bonuses,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  bonuses: LoyaltyBonusListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("dashboard.payments.bonuses");
  const paymentsT = useTranslations("dashboard.payments");
  const { currency, dateTime } = useMoneyFormat();

  const columns: Array<DataTableColumn<LoyaltyBonusListItem>> = [
    {
      key: "concept",
      mobile: "title",
      header: t("columns.concept"),
      className: "min-w-56",
      cell: (bonus) => (
        <span className="flex flex-col">
          <span className="font-medium">
            {bonus.concept.length > 0 ? bonus.concept : paymentsT("noConcept")}
          </span>
          <span className="text-muted-foreground text-copy-sm font-mono tabular-nums">
            {t("paymentAmount", { amount: currency(bonus.paymentAmountCents) })}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      mobile: "trailing",
      header: t("columns.amount"),
      className: "text-right",
      cell: (bonus) => (
        <span className="flex flex-col items-end">
          <span className="font-mono font-semibold tabular-nums">
            {currency(bonus.amountCents)}
          </span>
          <span className="text-muted-foreground text-copy-sm tabular-nums">
            {t("pct", { percent: bonus.pctApplied })}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      mobile: "status",
      header: t("columns.status"),
      cell: (bonus) => (
        <LoyaltyBonusStatusBadge
          status={bonus.status}
          label={t(`status.${bonus.status}`)}
        />
      ),
    },
    {
      key: "earned",
      mobile: "meta",
      header: t("columns.earned"),
      className: "min-w-36",
      cell: (bonus) => (
        <time
          dateTime={bonus.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm"
        >
          {dateTime(bonus.createdAt)}
        </time>
      ),
    },
    {
      key: "paid",
      mobile: "meta",
      header: t("columns.paid"),
      className: "min-w-40",
      cell: (bonus) =>
        bonus.paidAt ? (
          <span className="flex flex-col">
            <time
              dateTime={bonus.paidAt.toISOString()}
              className="text-copy-sm"
            >
              {dateTime(bonus.paidAt)}
            </time>
            {bonus.method ? (
              <span className="text-muted-foreground text-copy-sm">
                {t(`methods.${bonus.method}`)}
              </span>
            ) : null}
          </span>
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
          data={bonuses}
          getRowId={(bonus) => bonus.id}
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
      </CardContent>
      {hasMore ? (
        <PaymentsLoadMore loading={loadingMore} onLoadMore={onLoadMore} />
      ) : null}
    </Card>
  );
}
