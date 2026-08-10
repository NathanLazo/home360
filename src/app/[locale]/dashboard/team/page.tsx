import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { TeamView } from "./_components/team-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type TeamPageProps = { params: Promise<{ locale: string }> };

export default async function TeamPage({ params }: TeamPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  await Promise.all([api.team.list.prefetch(), api.branch.list.prefetch()]);

  return (
    <HydrateClient>
      <TeamView />
    </HydrateClient>
  );
}
