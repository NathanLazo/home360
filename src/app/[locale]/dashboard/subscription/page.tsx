import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SubscriptionView } from "./_components/subscription-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type SubscriptionPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SubscriptionPage({
  params,
}: SubscriptionPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.subscription.getCurrent.prefetch(),
    api.subscription.listPlans.prefetch(),
    api.subscription.listInvoices.prefetchInfinite({}),
  ]);

  return (
    <HydrateClient>
      <SubscriptionView />
    </HydrateClient>
  );
}
