import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SettingsView } from "./_components/settings-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type SettingsPageProps = { params: Promise<{ locale: string }> };

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  await api.businessSettings.get.prefetch();

  return (
    <HydrateClient>
      <SettingsView />
    </HydrateClient>
  );
}
