"use client";

import { useTranslations } from "next-intl";

import { DashboardRangeSelect } from "./dashboard-range-select";
import { HomePrimaryAction } from "./home-primary-action";
import { KpiRow } from "./kpi-row";
import { OrderActivityCard } from "./order-activity-card";
import { OrderPipelineCard } from "./order-pipeline-card";
import { OrdersByBranchList } from "./orders-by-branch-list";
import { RecentOrdersTable } from "./recent-orders-table";
import { RevenueTrendCard } from "./revenue-trend-card";
import { WeeklyRevenueChart } from "./weekly-revenue-chart";
import { PageHeader } from "~/components/page-header";
import type { DashboardRangeDays } from "~/lib/search-params";

export type DashboardViewProps = {
  branchId?: string;
  days: DashboardRangeDays;
};

/**
 * Mobile-first home: one column on phones, ordered by what an owner checks
 * first (money → workload → flow → detail); grids open up from `sm`/`lg`.
 */
export function DashboardView({ branchId, days }: DashboardViewProps) {
  const t = useTranslations("dashboard.home");

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <DashboardRangeSelect />
            <HomePrimaryAction />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueTrendCard
          branchId={branchId}
          days={days}
          className="lg:col-span-2"
        />
        <KpiRow branchId={branchId} days={days} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <OrderPipelineCard branchId={branchId} days={days} />
        <OrderActivityCard branchId={branchId} days={days} />
      </div>
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <WeeklyRevenueChart
          branchId={branchId}
          days={days}
          className="xl:col-span-2"
        />
        <OrdersByBranchList branchId={branchId} days={days} />
      </div>
      <RecentOrdersTable branchId={branchId} days={days} />
    </div>
  );
}
