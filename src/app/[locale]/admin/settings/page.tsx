import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SettingsView } from "./_components/settings-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.admin.settings.get.prefetch(),
    api.admin.settings.listCampaigns.prefetchInfinite({}),
  ]);

  return (
    <HydrateClient>
      <SettingsView />
    </HydrateClient>
  );
}
