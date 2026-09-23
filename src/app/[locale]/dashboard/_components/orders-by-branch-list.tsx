"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { Building2Icon, RotateCcwIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import {
  DonutDistributionChart,
  donutPalette,
  type DonutDatum,
} from "~/components/donut-distribution-chart";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import type { DashboardRangeDays } from "~/lib/search-params";
import { api } from "~/trpc/react";

/** Slices beyond this count collapse into a single "others" slice. */
const MAX_DONUT_SLICES = 5;

export type OrdersByBranchListProps = {
  branchId?: string;
  days: DashboardRangeDays;
};

export function OrdersByBranchList({
  branchId,
  days,
}: OrdersByBranchListProps) {
  const t = useTranslations("dashboard.home");
  const errors = useTranslations("errors");
  const formatter = useFormatter();
  const input = branchId ? { branchId, days } : { days };
  const query = api.dashboard.getOrdersByBranch.useQuery(input, {
    placeholderData: keepPreviousData,
  });
  const response = query.data;

  if (query.isPending) {
    return (
      <Card aria-busy="true" role="status">
        <CardHeader>
          <span className="sr-only">{t("loadingBranches")}</span>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5">
          <Skeleton className="aspect-square w-full max-w-56 rounded-full" />
          <div className="flex w-full flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Skeleton className="size-2.5 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </span>
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error || !response || response.error || !response.result) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>
            <h2>{t("branchOrdersTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("queryErrorTitle")}</p>
            <p className="text-muted-foreground text-copy-sm">
              {response?.error
                ? errors(response.error)
                : t("queryErrorDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = response.result;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("branchOrdersTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            headingLevel="h3"
            icon={Building2Icon}
            title={t("branchEmptyTitle")}
            description={t("branchEmptyDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  const rows = data.map((row, index) => ({
    key: row.branchId ?? "unassigned",
    label: row.branchName ?? t("noBranch"),
    count: row.ordersCount,
    color: donutPalette[index % donutPalette.length],
  }));
  const topRows = rows.slice(0, MAX_DONUT_SLICES);
  const restCount = rows
    .slice(MAX_DONUT_SLICES)
    .reduce((total, row) => total + row.count, 0);
  const donutData: DonutDatum[] = topRows.map((row) => ({
    label: row.label,
    value: row.count,
    color: row.color,
  }));
  if (restCount > 0) {
    donutData.push({ label: t("otherBranches"), value: restCount });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("branchOrdersTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DonutDistributionChart
          data={donutData}
          centerLabel={t("branchChartCenterLabel")}
          className="mx-auto max-w-56"
        />
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="text-copy-sm flex items-center justify-between gap-4"
              aria-label={t("branchCountLabel", {
                branch: row.label,
                count: row.count,
              })}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="min-w-0 truncate">{row.label}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatter.number(row.count)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
