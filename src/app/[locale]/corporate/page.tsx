import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CorporateOverview } from "./_components/corporate-overview";
import { parseMonthParam } from "./_components/corporate-search-params";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

const RECENT_ORDERS_LIMIT = 5;

type CorporatePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CorporatePage({
  params,
  searchParams,
}: CorporatePageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const month = parseMonthParam(resolvedSearchParams);

  await Promise.all([
    api.corporate.getOverview.prefetch(month ? { month } : {}),
    api.corporate.listOrders.prefetch({ limit: RECENT_ORDERS_LIMIT }),
  ]);

  return (
    <HydrateClient>
      <CorporateOverview month={month} recentLimit={RECENT_ORDERS_LIMIT} />
    </HydrateClient>
  );
}
