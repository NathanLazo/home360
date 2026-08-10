import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OverviewView } from "./_components/overview-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.admin.overview.getKpis.prefetch(),
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
