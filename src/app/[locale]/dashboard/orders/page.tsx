import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrdersView } from "./_components/orders-view";
import { redirect } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { parseBranchParam } from "~/lib/search-params";
import { api, HydrateClient } from "~/trpc/server";

type OrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({
  params,
  searchParams,
}: OrdersPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const branchId = parseBranchParam(resolvedSearchParams);

  // Requests and offers moved to their own screen: keep old deep links alive.
  const legacyTab = resolvedSearchParams.tab;
  if (legacyTab === "requests" || legacyTab === "offers") {
    const params = new URLSearchParams();
    if (legacyTab === "offers") params.set("tab", "offers");
    const requestId = resolvedSearchParams.request;
    if (typeof requestId === "string") params.set("request", requestId);
    if (branchId) params.set("branch", branchId);
    const query = params.toString();
    redirect({
      href:
        query.length > 0
          ? `/dashboard/requests?${query}`
          : "/dashboard/requests",
      locale,
    });
  }

  await api.order.list.prefetchInfinite(branchId ? { branchId } : {});

  return (
    <HydrateClient>
      <OrdersView branchId={branchId} />
    </HydrateClient>
  );
}
