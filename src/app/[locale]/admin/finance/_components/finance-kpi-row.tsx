"use client";

import {
  BanknoteIcon,
  LockKeyholeIcon,
  PercentIcon,
  RepeatIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AnimatedKpiCard } from "../../_components/animated-kpi-card";
import { MXN_FORMAT } from "../../_components/animated-number";
import type { FinanceKpis } from "./finance.types";

export function FinanceKpiRow({ kpis }: { kpis: FinanceKpis }) {
  const t = useTranslations("admin.finance.kpis");
  const delta = kpis.platformGrossRevenueDeltaPct;

  // Approving a withdrawal invalidates these figures; NumberFlow rolls the
  // changed digits so the admin sees exactly which total moved.
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("label")}
    >
      <AnimatedKpiCard
        label={t("platformGrossRevenue")}
        value={kpis.platformGrossRevenueCents / 100}
        format={MXN_FORMAT}
        icon={PercentIcon}
        delta={{
          text:
            delta === null
              ? t("noBaseline")
              : t("platformGrossRevenueDelta", { value: delta }),
          trend:
            delta === null || delta === 0
              ? "neutral"
              : delta > 0
                ? "up"
                : "down",
        }}
      />
      <AnimatedKpiCard
        label={t("subscriptions")}
        value={kpis.subscriptionCents / 100}
        format={MXN_FORMAT}
        icon={RepeatIcon}
        delta={{
          text: t("activeBusinesses", { count: kpis.activeBusinesses }),
          trend: "neutral",
        }}
      />
      <AnimatedKpiCard
        label={t("escrow")}
        value={kpis.escrowCents / 100}
        format={MXN_FORMAT}
        icon={LockKeyholeIcon}
        delta={{
          text: t("escrowOrders", { count: kpis.escrowOrdersCount }),
          trend: "neutral",
        }}
      />
      <AnimatedKpiCard
        label={t("pendingWithdrawals")}
        value={kpis.pendingWithdrawalsCents / 100}
        format={MXN_FORMAT}
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
