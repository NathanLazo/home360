import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { UsersView } from "./_components/users-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type UsersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminUsersPage({ params }: UsersPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await api.admin.users.list.prefetchInfinite({ tab: "businesses" });

  return (
    <HydrateClient>
      <UsersView />
    </HydrateClient>
  );
}
