import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ServicesView } from "./_components/services-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type ServicesPageProps = { params: Promise<{ locale: string }> };

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  await Promise.all([
    api.service.list.prefetchInfinite({}),
    api.service.listCategories.prefetch(),
    api.service.listWorkers.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ServicesView />
    </HydrateClient>
  );
}
