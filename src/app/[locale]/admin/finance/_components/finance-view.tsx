"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { KpiGridSkeleton } from "../../_components/kpi-grid-skeleton";
import { SectionHeading } from "../../_components/section-heading";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "../../_components/table-skeleton";
import { FinanceKpiRow } from "./finance-kpi-row";
import { PlatformRevenueChart } from "./platform-revenue-chart";
import { RevenueBreakdownList } from "./revenue-breakdown-list";
import { RevenueBreakdownSkeleton } from "./revenue-breakdown-skeleton";
import { LoyaltyBonusesTable } from "./loyalty-bonuses-table";
import { PayLoyaltyBonusDialog } from "./pay-loyalty-bonus-dialog";
import type { LoyaltyBonusRow } from "./finance.types";
import {
  useLoyaltyMutations,
  useWithdrawalMutations,
} from "./use-withdrawal-mutations";
import { WithdrawalsTable } from "./withdrawals-table";
import { withdrawalStatusSchema } from "./finance.schema";
import type { WithdrawalStatus } from "@generated/prisma";
import { WithdrawalStatus as WithdrawalStatusEnum } from "@generated/prisma";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toErrorCode } from "~/lib/trpc-errors";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const ALL_STATUSES = "all";
const REVENUE_MONTHS = 6;

const WITHDRAWAL_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-36" },
  { width: "w-24", align: "end" },
  { width: "w-28" },
  { width: "w-20" },
  { width: "w-20" },
  { width: "w-32", align: "end" },
];

const LOYALTY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-36" },
  { width: "w-20", align: "end" },
  { width: "w-40" },
  { width: "w-20" },
  { width: "w-16" },
  { width: "w-36", align: "end" },
];

export function FinanceView() {
  const t = useTranslations("admin.finance");
  const statusT = useTranslations("admin.withdrawalStatus");
  const [status, setStatus] = useState<WithdrawalStatus | null>(null);

  const kpisQuery = api.admin.finance.getKpis.useQuery({});
  const breakdownQuery = api.admin.finance.getRevenueBreakdown.useQuery({
    months: REVENUE_MONTHS,
  });
  const withdrawalsQuery = api.admin.finance.listWithdrawals.useInfiniteQuery(
    status ? { status } : {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const loyaltyQuery = api.admin.finance.listLoyaltyBonuses.useQuery({});

  const kpis = unwrapEnvelope(kpisQuery);
  const breakdown = unwrapEnvelope(breakdownQuery);
  const loyalty = unwrapEnvelope(loyaltyQuery);
  const mutations = useWithdrawalMutations();
  const [payingBonus, setPayingBonus] = useState<LoyaltyBonusRow | null>(null);
  const [cancellingBonus, setCancellingBonus] =
    useState<LoyaltyBonusRow | null>(null);
  const loyaltyMutations = useLoyaltyMutations({
    onSettled: () => {
      setPayingBonus(null);
      setCancellingBonus(null);
    },
  });

  const pages = withdrawalsQuery.data?.pages ?? [];
  const withdrawalsErrorCode =
    pages.find((page) => page.error !== null)?.error ??
    (withdrawalsQuery.error ? toErrorCode(withdrawalsQuery.error) : null);
  const withdrawals = pages.flatMap((page) => page.result?.items ?? []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {kpis.status === "pending" ? (
        <KpiGridSkeleton label={t("kpis.loading")} />
      ) : null}
      {kpis.status === "error" ? (
        <SectionError
          title={t("kpis.errorTitle")}
          code={kpis.code}
          onRetry={() => void kpisQuery.refetch()}
        />
      ) : null}
      {kpis.status === "success" ? <FinanceKpiRow kpis={kpis.data} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {breakdown.status === "pending" ? (
          <RevenueBreakdownSkeleton label={t("breakdown.loading")} />
        ) : null}
        {breakdown.status === "error" ? (
          <div className="xl:col-span-2">
            <SectionError
              title={t("breakdown.errorTitle")}
              code={breakdown.code}
              onRetry={() => void breakdownQuery.refetch()}
            />
          </div>
        ) : null}
        {breakdown.status === "success" ? (
          <>
            <PlatformRevenueChart series={breakdown.data.series} />
            <RevenueBreakdownList breakdown={breakdown.data} />
          </>
        ) : null}
      </div>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="admin-finance-withdrawals"
      >
        <SectionHeading
          id="admin-finance-withdrawals"
          title={t("withdrawals.title")}
          action={
            <Select
              value={status ?? ALL_STATUSES}
              onValueChange={(value) =>
                setStatus(
                  value === ALL_STATUSES
                    ? null
                    : withdrawalStatusSchema.parse(value),
                )
              }
            >
              <SelectTrigger className="min-h-11 w-48 sm:min-h-10">
                <SelectValue aria-label={t("withdrawals.statusFilterLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>
                  {t("withdrawals.allStatuses")}
                </SelectItem>
                {Object.values(WithdrawalStatusEnum).map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusT(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {withdrawalsQuery.isPending ? (
          <TableSkeleton
            columns={WITHDRAWAL_SKELETON_COLUMNS}
            rows={5}
            label={t("withdrawals.loading")}
          />
        ) : null}

        {!withdrawalsQuery.isPending && withdrawalsErrorCode !== null ? (
          <SectionError
            title={t("withdrawals.errorTitle")}
            code={withdrawalsErrorCode}
            onRetry={() => void withdrawalsQuery.refetch()}
          />
        ) : null}

        {!withdrawalsQuery.isPending && withdrawalsErrorCode === null ? (
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0">
              <WithdrawalsTable
                withdrawals={withdrawals}
                pending={mutations.pending}
                onApprove={(withdrawalId) =>
                  mutations.approve({ withdrawalId })
                }
                onReject={mutations.reject}
                emptyAction={
                  status !== null ? (
                    <ClearFiltersButton onClear={() => setStatus(null)} />
                  ) : undefined
                }
              />
            </CardContent>
            {withdrawalsQuery.hasNextPage ? (
              <div className="flex justify-center border-t p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
                  disabled={withdrawalsQuery.isFetchingNextPage}
                  onClick={() => void withdrawalsQuery.fetchNextPage()}
                >
                  {withdrawalsQuery.isFetchingNextPage ? (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : null}
                  {t("withdrawals.loadMore")}
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </section>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="admin-finance-loyalty"
      >
        <SectionHeading
          id="admin-finance-loyalty"
          title={t("loyalty.title")}
          description={t("loyalty.description")}
        />

        {loyalty.status === "pending" ? (
          <TableSkeleton
            columns={LOYALTY_SKELETON_COLUMNS}
            rows={4}
            label={t("loyalty.loading")}
          />
        ) : null}

        {loyalty.status === "error" ? (
          <SectionError
            title={t("loyalty.errorTitle")}
            code={loyalty.code}
            onRetry={() => void loyaltyQuery.refetch()}
          />
        ) : null}

        {loyalty.status === "success" ? (
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0">
              <LoyaltyBonusesTable
                bonuses={loyalty.data.items}
                onPay={setPayingBonus}
                onCancel={setCancellingBonus}
              />
            </CardContent>
          </Card>
        ) : null}
      </section>

      <PayLoyaltyBonusDialog
        bonus={payingBonus}
        loading={loyaltyMutations.pending}
        onOpenChange={(open) => {
          if (!open) {
            setPayingBonus(null);
          }
        }}
        onConfirm={loyaltyMutations.pay}
      />

      {/* Writing a bonus off is irreversible, so it is confirmed like every
          other money-moving action on this screen. */}
      <ConfirmDialog
        open={cancellingBonus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingBonus(null);
          }
        }}
        title={t("loyalty.cancelDialog.title")}
        description={t("loyalty.cancelDialog.description", {
          business: cancellingBonus?.business.name ?? "",
        })}
        confirmLabel={t("loyalty.cancelDialog.confirm")}
        cancelLabel={t("loyalty.cancelDialog.dismiss")}
        destructive
        loading={loyaltyMutations.pending}
        onConfirm={() => {
          if (cancellingBonus) {
            loyaltyMutations.cancel({
              bonusId: cancellingBonus.id,
              reason: t("loyalty.cancelReason"),
            });
          }
        }}
      />
    </div>
  );
}
