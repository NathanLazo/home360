"use client";

import {
  BuildingIcon,
  LockKeyholeIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { PlatformKpis } from "./overview.types";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { KpiCard, type KpiCardProps } from "~/components/kpi-card";

function gmvDelta(
  deltaPct: number | null,
  t: (key: string, values?: Record<string, number>) => string,
): NonNullable<KpiCardProps["delta"]> {
  if (deltaPct === null) {
    return { text: t("kpis.gmvNoBaseline"), trend: "neutral" };
  }

  return {
    text: t("kpis.gmvDelta", { value: deltaPct }),
    trend: deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "neutral",
  };
}

export function KpiRow({ kpis }: { kpis: PlatformKpis }) {
  const t = useTranslations("admin.overview");
  const currency = useCurrencyFormatter();

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("kpis.label")}
    >
      <KpiCard
        label={t("kpis.totalUsers")}
        value={String(kpis.totalUsers)}
        icon={UsersIcon}
        delta={{
          text: t("kpis.newUsersMonth", { count: kpis.newUsersMonth }),
          trend: kpis.newUsersMonth > 0 ? "up" : "neutral",
        }}
      />
      <KpiCard
        label={t("kpis.activeBusinesses")}
        value={String(kpis.activeBusinesses)}
        icon={BuildingIcon}
        delta={{
          text: t("kpis.pendingBusinesses", { count: kpis.pendingBusinesses }),
          trend: kpis.pendingBusinesses > 0 ? "down" : "neutral",
        }}
      />
      <KpiCard
        label={t("kpis.gmv")}
        value={currency(kpis.gmvCents)}
        icon={TrendingUpIcon}
        delta={gmvDelta(kpis.gmvDeltaPct, t)}
      />
      <KpiCard
        label={t("kpis.escrow")}
        value={currency(kpis.escrowCents)}
        icon={LockKeyholeIcon}
        delta={{
          text: t("kpis.escrowOrders", { count: kpis.escrowOrders }),
          trend: "neutral",
        }}
      />
    </section>
  );
}
