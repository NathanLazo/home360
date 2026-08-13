import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  parseLocationParam,
  parseOrderStatusParam,
} from "../_components/corporate-search-params";
import { CorporateOrdersView } from "./_components/corporate-orders-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type CorporateOrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CorporateOrdersPage({
  params,
  searchParams,
}: CorporateOrdersPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const locationId = parseLocationParam(resolvedSearchParams);
  const status = parseOrderStatusParam(resolvedSearchParams);

  await Promise.all([
    api.corporate.listOrders.prefetchInfinite({
      ...(locationId ? { locationId } : {}),
      ...(status ? { status } : {}),
    }),
    api.corporate.listLocations.prefetch({ includeInactive: true }),
  ]);

  return (
    <HydrateClient>
      <CorporateOrdersView locationId={locationId} status={status} />
    </HydrateClient>
  );
}
