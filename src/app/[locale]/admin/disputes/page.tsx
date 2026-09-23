import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DisputesView } from "./_components/disputes-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type DisputesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDisputesPage({ params }: DisputesPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await api.admin.disputes.list.prefetchInfinite({ status: "open" });

  return (
    <HydrateClient>
      <DisputesView />
    </HydrateClient>
  );
}
