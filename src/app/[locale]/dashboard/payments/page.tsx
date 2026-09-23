import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  parsePaymentsBranch,
  parsePaymentsTab,
  type PaymentsTab,
} from "./_components/payments-search-params";
import { PaymentsView } from "./_components/payments-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type PaymentsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Only the tab the user lands on is prefetched; the others load on demand. */
function prefetchTab(tab: PaymentsTab, branchId: string | undefined) {
  switch (tab) {
    case "transactions":
      return api.payment.listTransactions.prefetchInfinite(
        branchId ? { branchId } : {},
      );
    case "links":
      return api.payment.listPaymentLinks.prefetchInfinite({});
    case "withdrawals":
      return api.payment.listWithdrawals.prefetchInfinite({});
    case "bonuses":
      return api.payment.listLoyaltyBonuses.prefetchInfinite({});
  }
}

export default async function PaymentsPage({
  params,
  searchParams,
}: PaymentsPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const tab = parsePaymentsTab(resolvedSearchParams.tab);
  const branchId = parsePaymentsBranch(resolvedSearchParams.branch);

  await Promise.all([
    api.payment.getBalances.prefetch(),
    prefetchTab(tab, branchId),
    // Feeds the commission percentage of the balances card (F3-12 debt).
    api.subscription.getCurrent.prefetch(),
  ]);

  return (
    <HydrateClient>
      <PaymentsView />
    </HydrateClient>
  );
}
