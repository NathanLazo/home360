"use client";

import {
  BuildingIcon,
  LockKeyholeIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AnimatedKpiCard,
  type AnimatedKpiCardProps,
} from "./animated-kpi-card";
import { MXN_FORMAT } from "./animated-number";
import type { PlatformKpis } from "./overview.types";

function gmvDelta(
  deltaPct: number | null,
  t: (key: string, values?: Record<string, number>) => string,
): NonNullable<AnimatedKpiCardProps["delta"]> {
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

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("kpis.label")}
    >
      <AnimatedKpiCard
        label={t("kpis.totalUsers")}
        value={kpis.totalUsers}
        icon={UsersIcon}
        delta={{
          text: t("kpis.newUsersMonth", { count: kpis.newUsersMonth }),
          trend: kpis.newUsersMonth > 0 ? "up" : "neutral",
        }}
      />
      <AnimatedKpiCard
        label={t("kpis.activeBusinesses")}
        value={kpis.activeBusinesses}
        icon={BuildingIcon}
        delta={{
          text: t("kpis.pendingBusinesses", { count: kpis.pendingBusinesses }),
          trend: kpis.pendingBusinesses > 0 ? "down" : "neutral",
        }}
      />
      <AnimatedKpiCard
        label={t("kpis.gmv")}
        value={kpis.gmvCents / 100}
        format={MXN_FORMAT}
        icon={TrendingUpIcon}
        delta={gmvDelta(kpis.gmvDeltaPct, t)}
      />
      <AnimatedKpiCard
        label={t("kpis.escrow")}
        value={kpis.escrowCents / 100}
        format={MXN_FORMAT}
        icon={LockKeyholeIcon}
        delta={{
          text: t("kpis.escrowOrders", { count: kpis.escrowOrdersCount }),
          trend: "neutral",
        }}
      />
    </section>
  );
}
