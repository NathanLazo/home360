"use client";

import { useTranslations } from "next-intl";

import { HomePrimaryAction } from "./home-primary-action";
import { KpiRow } from "./kpi-row";
import { OrdersByBranchList } from "./orders-by-branch-list";
import { RecentOrdersTable } from "./recent-orders-table";
import { WeeklyRevenueChart } from "./weekly-revenue-chart";
import { PageHeader } from "~/components/page-header";
import type { DashboardRangeDays } from "~/lib/search-params";

export type DashboardViewProps = {
  branchId?: string;
  days: DashboardRangeDays;
};

export function DashboardView({ branchId, days }: DashboardViewProps) {
  const t = useTranslations("dashboard.home");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<HomePrimaryAction />}
      />
      <KpiRow branchId={branchId} days={days} />
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <WeeklyRevenueChart
          branchId={branchId}
          days={days}
          className="xl:col-span-2"
        />
        <OrdersByBranchList branchId={branchId} days={days} />
      </div>
      <RecentOrdersTable branchId={branchId} />
    </div>
  );
}
