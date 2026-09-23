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

const CURRENCY_FORMAT = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export function BalanceCards({ balances, commissionPct }: BalanceCardsProps) {
  const t = useTranslations("dashboard.payments");
  const formatter = useFormatter();
  // The only arithmetic allowed on the client: cents -> major units for
  // `Intl.NumberFormat`. Every amount below arrives already derived from the
  // server (XC-03 net formula).
  const currency = (cents: number) =>
    formatter.number(cents / 100, CURRENCY_FORMAT);
  // Same figure for NumberFlow, so a withdrawal rolls the balance in place.
  const numeric = (cents: number) => ({
    value: cents / 100,
    format: CURRENCY_FORMAT,
  });

  return (
    <section
      className="grid gap-4 md:grid-cols-3"
      aria-label={t("balancesLabel")}
    >
      <KpiCard
        label={t("balances.available")}
        value={currency(balances.availableCents)}
        numeric={numeric(balances.availableCents)}
        icon={WalletIcon}
        delta={{ text: t("balances.availableHint"), trend: "neutral" }}
      />
      <KpiCard
        label={t("balances.escrow")}
        value={currency(balances.escrowCents)}
        numeric={numeric(balances.escrowCents)}
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
        numeric={numeric(balances.monthCommissionCents)}
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
