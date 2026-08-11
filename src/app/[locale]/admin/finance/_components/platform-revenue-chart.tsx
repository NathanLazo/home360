"use client";

import { BarChart3Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { RevenuePoint } from "./finance.types";
import { ChartSeriesLegend } from "~/components/chart-series-legend";
import { EmptyState } from "~/components/empty-state";
import {
  StackedCurrencyBarChart,
  type CurrencyBarSeries,
} from "~/components/stacked-currency-bar-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type ChartPoint = RevenuePoint & { monthLabel: string };

/** "YYYY-MM" is rendered against a UTC anchor so the label never shifts. */
function monthAnchor(month: string): Date {
  return new Date(`${month}-15T12:00:00.000Z`);
}

export function PlatformRevenueChart({ series }: { series: RevenuePoint[] }) {
  const t = useTranslations("admin.finance.chart");
  const formatter = useFormatter();

  if (series.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={BarChart3Icon}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  const data: ChartPoint[] = series.map((point) => ({
    ...point,
    monthLabel: formatter.dateTime(monthAnchor(point.month), {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }));

  const chartSeries: CurrencyBarSeries[] = [
    {
      dataKey: "commissionCents",
      label: t("commission"),
      color: "var(--chart-5)",
    },
    {
      dataKey: "subscriptionCents",
      label: t("subscriptions"),
      color: "var(--chart-3)",
    },
  ];

  const fullCurrency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="h-64 min-w-0 sm:h-72">
          <StackedCurrencyBarChart
            data={data}
            xDataKey="monthLabel"
            series={chartSeries}
            formatValue={fullCurrency}
            className="h-full"
          />
        </div>
        <ChartSeriesLegend items={chartSeries} className="justify-center" />
      </CardContent>
    </Card>
  );
}
