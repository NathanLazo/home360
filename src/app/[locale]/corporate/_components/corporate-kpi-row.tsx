"use client";

import { keepPreviousData } from "@tanstack/react-query";
import {
  BanknoteIcon,
  InboxIcon,
  MapPinIcon,
  PiggyBankIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { KpiCard } from "~/components/kpi-card";
import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { SectionError } from "~/components/section-error";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const CURRENCY_FORMAT = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export type CorporateKpiRowProps = {
  month?: string;
  locationId?: string;
};

/**
 * Consolidated KPIs of the account. The savings card only renders when the
 * frozen snapshots produced a real saving (`savedByRateCents > 0`): showing a
 * $0 saving would be worse than showing nothing.
 */
export function CorporateKpiRow({ month, locationId }: CorporateKpiRowProps) {
  const t = useTranslations("corporate.home");
  const tierT = useTranslations("corporate.tier");
  const formatter = useFormatter();
  const overviewInput = {
    ...(month ? { month } : {}),
    ...(locationId ? { locationId } : {}),
  };
  const query = api.corporate.getOverview.useQuery(overviewInput, {
    // Month switches keep the old figures until the new ones roll in.
    placeholderData: keepPreviousData,
  });
  const membershipQuery = api.corporate.getMembership.useQuery();
  const state = unwrapEnvelope(query);

  if (state.status === "pending") {
    return <KpiRowSkeleton label={t("loading")} />;
  }

  if (state.status === "error") {
    return (
      <SectionError
        title={t("queryErrorTitle")}
        code={state.code}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = state.data;
  const currency = (cents: number) =>
    formatter.number(cents / 100, CURRENCY_FORMAT);
  // Envelope-aware: the membership query only decorates the hints, so while
  // it is pending or failed the hint is omitted instead of guessing — saying
  // "no tier limit" before knowing the tier would be a lie.
  const membership =
    membershipQuery.data?.error === null
      ? (membershipQuery.data.result ?? null)
      : null;
  const tier = membership?.tier ?? null;
  const showSavings = data.savedByRateCents > 0;

  return (
    <section
      className={`grid gap-4 sm:grid-cols-2 ${
        showSavings ? "xl:grid-cols-4" : "xl:grid-cols-3"
      }`}
      aria-label={t("kpisLabel")}
      aria-busy={query.isPlaceholderData}
    >
      <KpiCard
        label={t("spent")}
        value={currency(data.spentCents)}
        numeric={{ value: data.spentCents / 100, format: CURRENCY_FORMAT }}
        icon={BanknoteIcon}
        delta={{
          text: t("spentHint", { count: data.ordersMonth }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("ordersActive")}
        value={formatter.number(data.ordersActive)}
        numeric={{ value: data.ordersActive }}
        icon={InboxIcon}
        delta={{ text: t("ordersActiveHint"), trend: "neutral" }}
      />
      <KpiCard
        label={t("locations")}
        value={formatter.number(data.locationsActive)}
        numeric={{ value: data.locationsActive }}
        icon={MapPinIcon}
        delta={
          membership
            ? {
                text:
                  membership.usage.max === null
                    ? t("locationsHintUnlimited")
                    : t("locationsHint", { max: membership.usage.max }),
                trend: "neutral",
              }
            : undefined
        }
      />
      {showSavings ? (
        <KpiCard
          label={t("savings")}
          value={currency(data.savedByRateCents)}
          numeric={{
            value: data.savedByRateCents / 100,
            format: CURRENCY_FORMAT,
          }}
          icon={PiggyBankIcon}
          delta={
            tier
              ? { text: t("savingsHint", { tier: tierT(tier) }), trend: "up" }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}
