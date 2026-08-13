import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  CORPORATE_TAB_STATUS,
  corporateTabSchema,
  corporateTierSchema,
} from "./_components/corporate.schema";
import { CorporateView } from "./_components/corporate-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type CorporatePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCorporatePage({
  params,
  searchParams,
}: CorporatePageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // Filters live in the URL; the prefetch mirrors them so the first client
  // render hydrates the exact page the user asked for.
  const tabParsed = corporateTabSchema.safeParse(firstParam(query.tab));
  const tab = tabParsed.success ? tabParsed.data : "all";
  const tierParsed = corporateTierSchema.safeParse(firstParam(query.tier));
  const search = firstParam(query.q)?.trim().slice(0, 100) ?? "";

  await api.admin.corporate.list.prefetchInfinite({
    ...(tab === "all" ? {} : { status: CORPORATE_TAB_STATUS[tab] }),
    ...(tierParsed.success ? { tier: tierParsed.data } : {}),
    ...(search.length > 0 ? { search } : {}),
  });

  return (
    <HydrateClient>
      <CorporateView />
    </HydrateClient>
  );
}
