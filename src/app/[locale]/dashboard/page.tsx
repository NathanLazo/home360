import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DashboardView } from "./_components/dashboard-view";
import { routing } from "~/i18n/routing";
import { parseBranchParam } from "~/lib/search-params";
import { api, HydrateClient } from "~/trpc/server";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ branch?: string | string[] }>;
};

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const branchId = parseBranchParam(resolvedSearchParams);
  const input = branchId ? { branchId } : {};

  await Promise.all([
    api.dashboard.getKpis.prefetch(input),
    api.dashboard.getWeeklyRevenue.prefetch(input),
    api.dashboard.getOrdersByBranch.prefetch(input),
    api.dashboard.getRecentOrders.prefetch(input),
  ]);

  return (
    <HydrateClient>
      <DashboardView branchId={branchId} />
    </HydrateClient>
  );
}
