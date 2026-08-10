"use client";

import { LockKeyholeIcon, PercentIcon, WalletIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { BusinessBalances } from "./payment.types";
import { KpiCard } from "~/components/kpi-card";

type BalanceCardsProps = {
  balances: BusinessBalances;
  /** Commission of the active plan; `null` while unknown (F3-12 debt). */
  commissionPct: number | null;
};

export function BalanceCards({ balances, commissionPct }: BalanceCardsProps) {
  const t = useTranslations("dashboard.payments");
  const formatter = useFormatter();
  // The only arithmetic allowed on the client: cents -> major units for
  // `Intl.NumberFormat`. Every amount below arrives already derived from the
  // server (XC-03 net formula).
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={t("balancesLabel")}
    >
      <KpiCard
        label={t("balances.available")}
        value={currency(balances.availableCents)}
        icon={WalletIcon}
        delta={{ text: t("balances.availableHint"), trend: "neutral" }}
      />
      <KpiCard
        label={t("balances.escrow")}
        value={currency(balances.escrowCents)}
        icon={LockKeyholeIcon}
        delta={{
          text: t("balances.escrowOrders", {
            count: balances.escrowOrdersCount,
          }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("balances.commission")}
        value={currency(balances.monthCommissionCents)}
        icon={PercentIcon}
        delta={{
          text:
            commissionPct === null
              ? t("balances.commissionHint")
              : t("balances.commissionHintWithRate", {
                  percent: commissionPct,
                }),
          trend: "neutral",
        }}
      />
    </section>
  );
}
