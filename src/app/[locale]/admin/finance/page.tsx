import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FinanceView } from "./_components/finance-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type FinancePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminFinancePage({ params }: FinancePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  await Promise.all([
    api.admin.finance.getKpis.prefetch({}),
    api.admin.finance.getRevenueBreakdown.prefetch({ months: 6 }),
    api.admin.finance.listWithdrawals.prefetchInfinite({}),
  ]);

  return (
    <HydrateClient>
      <FinanceView />
    </HydrateClient>
  );
}
