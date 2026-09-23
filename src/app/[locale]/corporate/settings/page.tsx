import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CorporateSettingsView } from "./_components/corporate-settings-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type CorporateSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CorporateSettingsPage({
  params,
}: CorporateSettingsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await api.corporate.getSettings.prefetch();

  return (
    <HydrateClient>
      <CorporateSettingsView />
    </HydrateClient>
  );
}
