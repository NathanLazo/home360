import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { overviewMonthSchema } from "./_components/overview.schema";
import { OverviewView } from "./_components/overview-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({
  params,
  searchParams,
}: AdminPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // The reported month lives in `?month=YYYY-MM`; the prefetch mirrors the
  // client hook so the first render hydrates the exact month requested.
  const monthParsed = overviewMonthSchema.safeParse(firstParam(query.month));

  await Promise.all([
    api.admin.overview.getKpis.prefetch(
      monthParsed.success ? { month: monthParsed.data } : {},
    ),
    api.admin.overview.getPendingBusinesses.prefetch(),
    api.admin.overview.getOpenDisputes.prefetch(),
    api.admin.overview.getAiConfigSummary.prefetch(),
  ]);

  return (
    <HydrateClient>
      <OverviewView />
    </HydrateClient>
  );
}
