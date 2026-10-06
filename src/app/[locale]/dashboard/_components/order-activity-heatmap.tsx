"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import {
  SUNDAY_FIRST_WEEK,
  toHeatmapColumns,
} from "./dashboard-insights.utils";
import type { DashboardInsights } from "./dashboard.types";
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionRoot,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from "~/components/charts/heatmap";

export type OrderActivityHeatmapProps = {
  activity: DashboardInsights["activity"];
};

/** GitHub-style daily order grid; weeks start on Monday (es-MX convention). */
export function OrderActivityHeatmap({ activity }: OrderActivityHeatmapProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
  const columns = useMemo(() => toHeatmapColumns(activity), [activity]);
  const dayLabels = useMemo(
    () =>
      SUNDAY_FIRST_WEEK.map((date) =>
        formatter.dateTime(date, { weekday: "short", timeZone: "UTC" }),
      ),
    [formatter],
  );
  const formatMonth = useCallback(
    (date: Date) => formatter.dateTime(date, { month: "short" }),
    [formatter],
  );
  const formatDate = useCallback(
    (date: Date) => formatter.dateTime(date, { day: "numeric", month: "long" }),
    [formatter],
  );
  const formatWeekday = useCallback(
    (date: Date) => formatter.dateTime(date, { weekday: "long" }),
    [formatter],
  );
  const formatCount = useCallback(
    (count: number) => t("activityCount", { count }),
    [t],
  );

  return (
    // One interaction root links legend hover with the cells.
    <HeatmapInteractionRoot>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
        <HeatmapChart
          data={columns}
          layout="fluid"
          weekStartDay={1}
          gap={3}
          margin={{ top: 24, right: 0, bottom: 0, left: 36 }}
          animationDuration={600}
        >
          <HeatmapCells cornerRadius={3} />
          <HeatmapXAxis formatMonth={formatMonth} />
          <HeatmapYAxis dayLabels={dayLabels} />
          <HeatmapTooltip
            formatDate={formatDate}
            formatWeekday={formatWeekday}
            formatLabel={formatCount}
          />
        </HeatmapChart>
        <HeatmapLegend
          lessLabel={t("activityLess")}
          moreLabel={t("activityMore")}
        />
      </div>
    </HeatmapInteractionRoot>
  );
}
