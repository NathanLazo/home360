"use client";

import { useTranslations } from "next-intl";

import { CorporateKpiRow } from "./corporate-kpi-row";
import { RecentCorporateOrders } from "./recent-corporate-orders";
import { PageHeader } from "~/components/page-header";

export type CorporateOverviewProps = {
  month?: string;
  recentLimit: number;
};

/** Orchestrates the overview: KPI row plus the latest consolidated orders. */
export function CorporateOverview({
  month,
  recentLimit,
}: CorporateOverviewProps) {
  const t = useTranslations("corporate.home");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CorporateKpiRow month={month} />
      <RecentCorporateOrders limit={recentLimit} />
    </div>
  );
}
