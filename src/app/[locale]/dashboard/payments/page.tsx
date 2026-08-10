import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PaymentsView } from "./_components/payments-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type PaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PaymentsPage({ params }: PaymentsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.payment.getBalances.prefetch(),
    api.payment.listTransactions.prefetchInfinite({}),
    // Feeds the commission percentage of the balances card (F3-12 debt).
    api.subscription.getCurrent.prefetch(),
  ]);

  return (
    <HydrateClient>
      <PaymentsView />
    </HydrateClient>
  );
}
