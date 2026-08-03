import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BranchesView } from "./_components/branches-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await api.branch.list.prefetch();
  return (
    <HydrateClient>
      <BranchesView />
    </HydrateClient>
  );
}
