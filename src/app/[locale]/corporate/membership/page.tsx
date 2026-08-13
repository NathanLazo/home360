import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { MembershipView } from "./_components/membership-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type CorporateMembershipPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CorporateMembershipPage({
  params,
}: CorporateMembershipPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.corporate.getMembership.prefetch(),
    api.corporate.listInvoices.prefetchInfinite({}),
  ]);

  return (
    <HydrateClient>
      <MembershipView />
    </HydrateClient>
  );
}
