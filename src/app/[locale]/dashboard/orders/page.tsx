import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrdersView } from "./_components/orders-view";
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

  await api.order.list.prefetchInfinite(branchId ? { branchId } : {});

  return (
    <HydrateClient>
      <OrdersView branchId={branchId} />
    </HydrateClient>
  );
}
