"use client";

import { useFormatter, useTranslations } from "next-intl";

import { toLocalDay } from "./dashboard-insights.utils";
import type { DashboardInsights } from "./dashboard.types";
import { Area } from "~/components/charts/area";
import { AreaChart } from "~/components/charts/area-chart";
import { Grid } from "~/components/charts/grid";
import { ChartTooltip } from "~/components/charts/tooltip";

export type RevenueTrendChartProps = {
  points: DashboardInsights["dailyRevenue"];
  formatCurrency: (cents: number) => string;
};

/**
 * Daily revenue as a bklit area. No time axis: the card header names the
 * range and the localized start/end dates sit under the plot, so labels stay
 * legible on a phone instead of colliding.
 */
export function RevenueTrendChart({
  points,
  formatCurrency,
}: RevenueTrendChartProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
  const data = points.map((point) => ({
    date: toLocalDay(point.date),
    revenueCents: point.revenueCents,
  }));
  const first = data[0];
  const last = data.at(-1);
  const dayLabel = (date: Date) =>
    formatter.dateTime(date, { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-2">
      <div className="h-40 min-w-0 sm:h-52 lg:h-56">
        <AreaChart
          data={data}
          xDataKey="date"
          aspectRatio="auto"
          className="h-full"
          margin={{ top: 8, right: 4, bottom: 8, left: 4 }}
          // Tool surface: a brief load-state reveal, not a showcase entrance.
          animationDuration={300}
        >
          <Grid strokeDasharray="4,4" numTicksRows={4} />
          <Area
            dataKey="revenueCents"
            fill="var(--chart-line-primary)"
            fillOpacity={0.24}
            strokeWidth={1.75}
          />
          <ChartTooltip
            showDatePill={false}
            rows={(point) => {
              const value = point.date;
              return [
                {
                  color: "var(--chart-line-primary)",
                  label:
                    value instanceof Date
                      ? dayLabel(value)
                      : t("revenueTrendSeries"),
                  value: formatCurrency(Number(point.revenueCents ?? 0)),
                },
              ];
            }}
          />
        </AreaChart>
      </div>
      {first && last ? (
        <div
          aria-hidden="true"
          className="text-muted-foreground text-label flex justify-between font-mono tabular-nums"
        >
          <span>{dayLabel(first.date)}</span>
          <span>{dayLabel(last.date)}</span>
        </div>
      ) : null}
    </div>
  );
}
