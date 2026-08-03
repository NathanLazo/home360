"use client";

import { useTranslations } from "next-intl";

import { KpiRow } from "./kpi-row";
import { OrdersByBranchList } from "./orders-by-branch-list";
import { RecentOrdersTable } from "./recent-orders-table";
import { WeeklyRevenueChart } from "./weekly-revenue-chart";
import { PageHeader } from "~/components/page-header";

export type DashboardViewProps = {
  branchId?: string;
};

export function DashboardView({ branchId }: DashboardViewProps) {
  const t = useTranslations("dashboard.home");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <KpiRow branchId={branchId} />
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <WeeklyRevenueChart branchId={branchId} className="xl:col-span-2" />
        <OrdersByBranchList branchId={branchId} />
      </div>
      <RecentOrdersTable branchId={branchId} />
    </div>
  );
}
