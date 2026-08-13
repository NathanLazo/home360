import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LocationsView } from "./_components/locations-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type CorporateLocationsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CorporateLocationsPage({
  params,
}: CorporateLocationsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.corporate.listLocations.prefetch({ includeInactive: true }),
    api.corporate.getMembership.prefetch(),
  ]);

  return (
    <HydrateClient>
      <LocationsView />
    </HydrateClient>
  );
}
