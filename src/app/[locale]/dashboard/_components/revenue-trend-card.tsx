"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { RevenueTrendChart } from "./revenue-trend-chart";
import { useDashboardInsights } from "./use-dashboard-insights";
import { KpiValue } from "~/components/kpi-value";
import { SectionError } from "~/components/section-error";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import type { DashboardRangeDays } from "~/lib/search-params";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export type RevenueTrendCardProps = {
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

/** Hero of the home: period revenue, its delta and the daily trend. */
export function RevenueTrendCard({
  branchId,
  days,
  className,
}: RevenueTrendCardProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
  // Same input as `KpiRow`: both read one cached `getKpis` entry.
  const kpisQuery = api.dashboard.getKpis.useQuery(
    branchId ? { branchId, days } : { days },
    { placeholderData: keepPreviousData },
  );
  const kpis = unwrapEnvelope(kpisQuery);
  const insights = useDashboardInsights(branchId, days);
  const trendState = insights.state;

  if (kpis.status === "pending" || trendState.status === "pending") {
    return (
      <Card className={className} aria-busy="true" role="status">
        <CardHeader>
          <span className="sr-only">{t("loadingInsights")}</span>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-md sm:h-52 lg:h-56" />
        </CardContent>
      </Card>
    );
  }

  const errorCode =
    kpis.status === "error"
      ? kpis.code
      : trendState.status === "error"
        ? trendState.code
        : null;

  if (
    errorCode !== null ||
    kpis.status !== "success" ||
    trendState.status !== "success"
  ) {
    return (
      <SectionError
        title={t("queryErrorTitle")}
        code={errorCode ?? "UNKNOWN_ERROR"}
        onRetry={() => {
          void kpisQuery.refetch();
          insights.retry();
        }}
      />
    );
  }

  const { revenueCents, revenueDeltaPct } = kpis.data;
  const points = trendState.data.dailyRevenue;
  const currency = (cents: number) =>
    formatter.number(cents / 100, CURRENCY_FORMAT);
  const peak = points.reduce(
    (best, point) => Math.max(best, point.revenueCents),
    0,
  );
  const trend =
    revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "up" : "down";
  const delta =
    revenueDeltaPct === null
      ? null
      : formatter.number(revenueDeltaPct / 100, {
          style: "percent",
          signDisplay: "always",
          maximumFractionDigits: 0,
        });

  return (
    <Card
      className={className}
      aria-busy={kpisQuery.isPlaceholderData || insights.isRefreshing}
    >
      <CardHeader>
        <CardTitle>
          <h2>{t("revenueTrendTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("revenueTrendRange", { days })}</CardDescription>
        <CardAction>
          <span
            aria-hidden="true"
            className={cn(
              "text-label rounded-full border px-2 py-0.5 font-mono tabular-nums",
              trend === "up" && "text-success-deep",
              trend === "down" && "text-error-deep",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {delta ?? t("notAvailable")}
          </span>
          {delta ? (
            <span className="sr-only">{t("revenueComparison", { delta })}</span>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-display-md sm:text-display-lg font-mono tabular-nums">
          <KpiValue value={revenueCents / 100} format={CURRENCY_FORMAT} />
        </p>
        {peak > 0 ? (
          <RevenueTrendChart points={points} formatCurrency={currency} />
        ) : (
          <p className="text-muted-foreground text-copy-sm bg-muted/40 flex h-40 items-center justify-center rounded-md border border-dashed sm:h-52 lg:h-56">
            {t("revenueTrendEmpty")}
          </p>
        )}
        <p className="sr-only">
          {t("revenueTrendSummary", {
            days,
            total: currency(revenueCents),
            peak: currency(peak),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
