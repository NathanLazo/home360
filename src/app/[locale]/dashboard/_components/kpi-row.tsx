"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { InboxIcon, LockKeyholeIcon, StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { KpiCard } from "~/components/kpi-card";
import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { SectionError } from "~/components/section-error";
import type { DashboardRangeDays } from "~/lib/search-params";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export type KpiRowProps = {
  branchId?: string;
  days: DashboardRangeDays;
  className?: string;
};

const CURRENCY_FORMAT = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const RATING_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

export function KpiRow({ branchId, days, className }: KpiRowProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
  const input = branchId ? { branchId, days } : { days };
  // Keep the previous figures on screen while a branch switch refetches, so
  // the numbers roll to their new values instead of flashing a skeleton.
  const query = api.dashboard.getKpis.useQuery(input, {
    placeholderData: keepPreviousData,
  });
  const state = unwrapEnvelope(query);

  if (state.status === "pending") {
    return (
      <KpiRowSkeleton
        count={3}
        label={t("loadingKpis")}
        className={cn(
          "grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-1 xl:grid-cols-1 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1",
          className,
        )}
      />
    );
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

  // Revenue lives in the hero trend card. Phones: two compact figures over a
  // full-width escrow card; `sm`: one row of three; `lg`: a side column.
  return (
    <section
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-1",
        className,
      )}
      aria-label={t("kpisLabel")}
      aria-busy={query.isPlaceholderData}
    >
      <KpiCard
        label={t("orders", { days })}
        value={formatter.number(data.ordersCount)}
        numeric={{ value: data.ordersCount }}
        icon={InboxIcon}
        delta={{
          text: t("ordersBreakdown", {
            services: data.serviceOrders,
            products: data.productOrders,
          }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("rating")}
        value={
          data.avgRating === null
            ? t("notAvailable")
            : formatter.number(data.avgRating, RATING_FORMAT)
        }
        numeric={
          data.avgRating === null
            ? undefined
            : { value: data.avgRating, format: RATING_FORMAT }
        }
        icon={StarIcon}
        delta={{
          text: t("reviews", { count: data.reviewsCount }),
          trend: "neutral",
        }}
      />
      <KpiCard
        className="col-span-2 sm:col-span-1"
        label={t("escrow")}
        value={currency(data.escrowCents)}
        numeric={{ value: data.escrowCents / 100, format: CURRENCY_FORMAT }}
        icon={LockKeyholeIcon}
        delta={{
          text: t("escrowOrders", { count: data.escrowOrdersCount }),
          trend: "neutral",
        }}
      />
    </section>
  );
}
