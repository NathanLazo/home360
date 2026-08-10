"use client";

import {
  BanknoteIcon,
  LockKeyholeIcon,
  PercentIcon,
  RepeatIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { FinanceKpis } from "./finance.types";
import { KpiCard } from "~/components/kpi-card";

export function FinanceKpiRow({ kpis }: { kpis: FinanceKpis }) {
  const t = useTranslations("admin.finance.kpis");
  const formatter = useFormatter();
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const delta = kpis.commissionDeltaPct;

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("label")}
    >
      <KpiCard
        label={t("commission")}
        value={currency(kpis.commissionCents)}
        icon={PercentIcon}
        delta={{
          text:
            delta === null
              ? t("noBaseline")
              : t("commissionDelta", { value: delta }),
          trend:
            delta === null || delta === 0 ? "neutral" : delta > 0 ? "up" : "down",
        }}
      />
      <KpiCard
        label={t("subscriptions")}
        value={currency(kpis.subscriptionCents)}
        icon={RepeatIcon}
        delta={{
          text: t("activeBusinesses", { count: kpis.activeBusinesses }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("escrow")}
        value={currency(kpis.escrowCents)}
        icon={LockKeyholeIcon}
        delta={{
          text: t("escrowOrders", { count: kpis.escrowOrdersCount }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("pendingWithdrawals")}
        value={currency(kpis.pendingWithdrawalsCents)}
        icon={BanknoteIcon}
        delta={{
          text: t("pendingWithdrawalsCount", {
            count: kpis.pendingWithdrawalsCount,
          }),
          trend: kpis.pendingWithdrawalsCount > 0 ? "down" : "neutral",
        }}
      />
    </section>
  );
}
