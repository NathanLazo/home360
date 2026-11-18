import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReportsView } from "./_components/reports-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type ReportsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminReportsPage({ params }: ReportsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await api.admin.reports.list.prefetchInfinite({ status: "open" });

  return (
    <HydrateClient>
      <ReportsView />
    </HydrateClient>
  );
}
