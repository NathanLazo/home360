"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { KpiGridSkeleton } from "../../_components/kpi-grid-skeleton";
import { FinanceKpiRow } from "./finance-kpi-row";
import { FinanceMonthSelect } from "./finance-month-select";
import { financeMonthSchema, REVENUE_MONTHS } from "./finance.schema";
import { LoyaltySection } from "./loyalty-section";
import { PlatformRevenueChart } from "./platform-revenue-chart";
import { RevenueBreakdownList } from "./revenue-breakdown-list";
import { RevenueBreakdownSkeleton } from "./revenue-breakdown-skeleton";
import { WithdrawalsSection } from "./withdrawals-section";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export function FinanceView() {
  const t = useTranslations("admin.finance");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `?month=YYYY-MM` anchors the KPIs and the revenue window; absent means
  // the current month.
  const month = useMemo(() => {
    const parsed = financeMonthSchema.safeParse(searchParams.get("month"));
    return parsed.success ? parsed.data : null;
  }, [searchParams]);

  const kpisQuery = api.admin.finance.getKpis.useQuery(month ? { month } : {});
  const breakdownQuery = api.admin.finance.getRevenueBreakdown.useQuery(
    month ? { months: REVENUE_MONTHS, month } : { months: REVENUE_MONTHS },
  );

  const kpis = unwrapEnvelope(kpisQuery);
  const breakdown = unwrapEnvelope(breakdownQuery);

  const selectMonth = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<FinanceMonthSelect value={month} onChange={selectMonth} />}
      />

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

      <WithdrawalsSection />

      <LoyaltySection />
    </div>
  );
}
