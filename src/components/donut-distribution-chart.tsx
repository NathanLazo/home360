"use client";

import type { ChartStatFlowFormat } from "~/components/charts/chart-stat-flow";
import { PieCenter } from "~/components/charts/pie-center";
import { PieChart } from "~/components/charts/pie-chart";
import { PieSlice } from "~/components/charts/pie-slice";

/** Dark-to-light ordering so the largest slice reads strongest. */
export const donutPalette = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
];

export type DonutDatum = {
  label: string;
  value: number;
  color?: string;
};

export type DonutDistributionChartProps = {
  data: DonutDatum[];
  centerLabel: string;
  formatOptions?: ChartStatFlowFormat;
  prefix?: string;
  innerRadius?: number;
  className?: string;
};

export function DonutDistributionChart({
  data,
  centerLabel,
  formatOptions,
  prefix,
  innerRadius = 64,
  className,
}: DonutDistributionChartProps) {
  const slices = data.map((datum, index) => ({
    ...datum,
    color: datum.color ?? donutPalette[index % donutPalette.length],
  }));

  return (
    <PieChart
      data={slices}
      innerRadius={innerRadius}
      padAngle={0.02}
      cornerRadius={4}
      className={className}
    >
      {slices.map((slice, index) => (
        <PieSlice key={slice.label} index={index} />
      ))}
      <PieCenter
        defaultLabel={centerLabel}
        formatOptions={formatOptions}
        prefix={prefix}
      />
    </PieChart>
  );
}
