import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FinanceView } from "./_components/finance-view";
import {
  financeMonthSchema,
  REVENUE_MONTHS,
} from "./_components/finance.schema";
import { LoyaltyBonusStatus } from "@generated/prisma";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type FinancePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function AdminFinancePage({
  params,
  searchParams,
}: FinancePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const parsedMonth = financeMonthSchema.safeParse((await searchParams).month);
  const month = parsedMonth.success ? parsedMonth.data : null;

  // Same inputs as FinanceView so every first-paint query hydrates.
  await Promise.all([
    api.admin.finance.getKpis.prefetch(month ? { month } : {}),
    api.admin.finance.getRevenueBreakdown.prefetch(
      month ? { months: REVENUE_MONTHS, month } : { months: REVENUE_MONTHS },
    ),
    api.admin.finance.listWithdrawals.prefetchInfinite({ view: "pending" }),
    api.admin.finance.listLoyaltyBonuses.prefetchInfinite({
      status: LoyaltyBonusStatus.PENDING,
    }),
  ]);

  return (
    <HydrateClient>
      <FinanceView />
    </HydrateClient>
  );
}
