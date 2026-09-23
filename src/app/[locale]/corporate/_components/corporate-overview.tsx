"use client";

import { useTranslations } from "next-intl";

import { CorporateKpiRow } from "./corporate-kpi-row";
import { OverviewFilters } from "./overview-filters";
import { OverviewPrimaryAction } from "./overview-primary-action";
import { RecentCorporateOrders } from "./recent-corporate-orders";
import { PageHeader } from "~/components/page-header";

export type CorporateOverviewProps = {
  month?: string;
  locationId?: string;
  recentLimit: number;
};

/** Orchestrates the overview: KPI row plus the latest consolidated orders. */
export function CorporateOverview({
  month,
  locationId,
  recentLimit,
}: CorporateOverviewProps) {
  const t = useTranslations("corporate.home");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<OverviewPrimaryAction />}
      />
      <OverviewFilters month={month} locationId={locationId} />
      <CorporateKpiRow month={month} locationId={locationId} />
      <RecentCorporateOrders limit={recentLimit} locationId={locationId} />
    </div>
  );
}
