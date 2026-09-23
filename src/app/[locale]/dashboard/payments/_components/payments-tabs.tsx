"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { LoyaltyBonusesPanel } from "./loyalty-bonuses-panel";
import { PaymentLinksPanel } from "./payment-links-panel";
import {
  DEFAULT_PAYMENTS_TAB,
  PAYMENTS_TABS,
  parsePaymentsBranch,
  parsePaymentsTab,
} from "./payments-search-params";
import { TransactionsPanel } from "./transactions-panel";
import { WithdrawalsPanel } from "./withdrawals-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePathname, useRouter } from "~/i18n/navigation";

/**
 * Transacciones | Links de cobro | Retiros | Bonos. The active tab lives in
 * `?tab=` so it survives reloads and can be deep-linked; `?branch=` from the
 * header selector is preserved on every tab change.
 */
export function PaymentsTabs() {
  const t = useTranslations("dashboard.payments.tabs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parsePaymentsTab(searchParams.get("tab"));
  const branchId = parsePaymentsBranch(searchParams.get("branch"));

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  function selectTab(value: string) {
    const next = parsePaymentsTab(value);
    replaceParams((params) => {
      if (next === DEFAULT_PAYMENTS_TAB) {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
    });
  }

  // The create dialog is owned by the header actions, which already honour
  // the `?create=link` deep link; the empty state reuses that entry point.
  function openCreateLink() {
    replaceParams((params) => params.set("create", "link"));
  }

  return (
    <Tabs value={tab} onValueChange={selectTab} className="gap-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList aria-label={t("label")} animatedIndicator>
          {PAYMENTS_TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="min-h-9 px-3">
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="transactions">
        <TransactionsPanel branchId={branchId} />
      </TabsContent>
      <TabsContent value="links">
        <PaymentLinksPanel onCreate={openCreateLink} />
      </TabsContent>
      <TabsContent value="withdrawals">
        <WithdrawalsPanel />
      </TabsContent>
      <TabsContent value="bonuses">
        <LoyaltyBonusesPanel />
      </TabsContent>
    </Tabs>
  );
}
