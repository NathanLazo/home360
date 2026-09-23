"use client";

import { Bar } from "~/components/charts/bar";
import { BarChart } from "~/components/charts/bar-chart";
import { BarXAxis } from "~/components/charts/bar-x-axis";
import { Grid } from "~/components/charts/grid";
import { ChartTooltip } from "~/components/charts/tooltip";

export type CurrencyBarSeries = {
  dataKey: string;
  label: string;
  color: string;
};

export type StackedCurrencyBarChartProps = {
  data: Record<string, unknown>[];
  xDataKey: string;
  series: CurrencyBarSeries[];
  stacked?: boolean;
  formatValue: (value: number) => string;
  className?: string;
};

export function StackedCurrencyBarChart({
  data,
  xDataKey,
  series,
  stacked = false,
  formatValue,
  className,
}: StackedCurrencyBarChartProps) {
  return (
    <BarChart
      data={data}
      xDataKey={xDataKey}
      stacked={stacked}
      aspectRatio="auto"
      className={className}
      margin={{ top: 8, right: 8, bottom: 36, left: 8 }}
      barGap={0.35}
      // Tool surfaces: a brief load-state reveal, not a showcase entrance.
      animationDuration={300}
    >
      <Grid strokeDasharray="4,4" />
      <BarXAxis />
      {series.map((entry) => (
        <Bar
          key={entry.dataKey}
          dataKey={entry.dataKey}
          fill={entry.color}
          lineCap={3}
        />
      ))}
      <ChartTooltip
        rows={(point) =>
          series.map((entry) => ({
            color: entry.color,
            label: entry.label,
            value: formatValue(Number(point[entry.dataKey] ?? 0)),
          }))
        }
      />
    </BarChart>
  );
}
