"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FinanceKpiRow } from "./finance-kpi-row";
import { PlatformRevenueChart } from "./platform-revenue-chart";
import { RevenueBreakdownList } from "./revenue-breakdown-list";
import { LoyaltyBonusesTable } from "./loyalty-bonuses-table";
import { PayLoyaltyBonusDialog } from "./pay-loyalty-bonus-dialog";
import type { LoyaltyBonusRow } from "./finance.types";
import {
  useLoyaltyMutations,
  useWithdrawalMutations,
} from "./use-withdrawal-mutations";
import { WithdrawalsTable } from "./withdrawals-table";
import { withdrawalStatusSchema } from "./finance.schema";
import type { WithdrawalStatus } from "../../../../../../generated/prisma";
import { WithdrawalStatus as WithdrawalStatusEnum } from "../../../../../../generated/prisma";
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
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const ALL_STATUSES = "all";
const REVENUE_MONTHS = 6;

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
    { getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined },
  );

  const loyaltyQuery = api.admin.finance.listLoyaltyBonuses.useQuery({});

  const kpis = unwrapEnvelope(kpisQuery);
  const breakdown = unwrapEnvelope(breakdownQuery);
  const loyalty = unwrapEnvelope(loyaltyQuery);
  const mutations = useWithdrawalMutations();
  const [payingBonus, setPayingBonus] = useState<LoyaltyBonusRow | null>(null);
  const loyaltyMutations = useLoyaltyMutations({
    onSettled: () => setPayingBonus(null),
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
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
          <>
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </>
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
        aria-label={t("withdrawals.title")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("withdrawals.title")}</h2>
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
        </div>

        {withdrawalsQuery.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
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

      <section className="flex flex-col gap-3" aria-label={t("loyalty.title")}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("loyalty.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("loyalty.description")}
          </p>
        </div>

        {loyalty.status === "pending" ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
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
                onCancel={(bonus) =>
                  loyaltyMutations.cancel({
                    bonusId: bonus.id,
                    reason: t("loyalty.cancelReason"),
                  })
                }
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
    </div>
  );
}
