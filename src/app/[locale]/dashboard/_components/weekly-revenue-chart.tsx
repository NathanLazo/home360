"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { BarChart3Icon, RotateCcwIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { WeeklyRevenuePoint } from "./dashboard.types";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  StackedCurrencyBarChart,
  type CurrencyBarSeries,
} from "~/components/stacked-currency-bar-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";

export type WeeklyRevenueChartProps = {
  branchId?: string;
  className?: string;
};

type ChartMode = "all" | "services" | "products";

type ChartPoint = WeeklyRevenuePoint & {
  weekLabel: string;
};

export function WeeklyRevenueChart({
  branchId,
  className,
}: WeeklyRevenueChartProps) {
  const t = useTranslations("dashboard.home");
  const errors = useTranslations("errors");
  const formatter = useFormatter();
  const input = branchId ? { branchId } : {};
  const query = api.dashboard.getWeeklyRevenue.useQuery(input, {
    placeholderData: keepPreviousData,
  });
  const response = query.data;

  if (query.isPending) {
    return (
      <Card className={className} aria-busy="true" role="status">
        <CardHeader>
          <span className="sr-only">{t("loadingChart")}</span>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56 self-start sm:self-end" />
          <Skeleton className="mt-2 h-64 rounded-md sm:h-72" />
        </CardContent>
      </Card>
    );
  }

  if (query.error || !response || response.error || !response.result) {
    return (
      <Card className={className} role="alert">
        <CardHeader>
          <CardTitle>
            <h2>{t("weeklyRevenueTitle")}</h2>
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
            className="min-h-11 sm:min-h-10"
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
  const hasRevenue = data.some(
    (point) => point.servicesCents > 0 || point.productsCents > 0,
  );

  if (!hasRevenue) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <h2>{t("weeklyRevenueTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            headingLevel="h3"
            icon={BarChart3Icon}
            title={t("revenueEmptyTitle")}
            description={t("revenueEmptyDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  const chartData: ChartPoint[] = data.map((point) => ({
    ...point,
    weekLabel: formatter.dateTime(point.weekStart, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  }));
  const series: CurrencyBarSeries[] = [
    {
      dataKey: "servicesCents",
      label: t("servicesTab"),
      color: "var(--chart-5)",
    },
    {
      dataKey: "productsCents",
      label: t("productsTab"),
      color: "var(--chart-3)",
    },
  ];
  const fullCurrency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
    });
  const servicesTotal = data.reduce(
    (total, point) => total + point.servicesCents,
    0,
  );
  const productsTotal = data.reduce(
    (total, point) => total + point.productsCents,
    0,
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2>{t("weeklyRevenueTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList
            animatedIndicator
            aria-label={t("chartFilterLabel")}
            className="self-start sm:self-end"
          >
            {(["all", "services", "products"] as const).map((mode) => (
              <TabsTrigger
                key={mode}
                value={mode}
                className="min-h-11 sm:min-h-10"
              >
                {t(`${mode}Tab`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <RevenueChartPanels
            data={chartData}
            series={series}
            fullCurrency={fullCurrency}
          />
        </Tabs>
        <p className="sr-only">
          {t("chartSummary", {
            services: fullCurrency(servicesTotal),
            products: fullCurrency(productsTotal),
          })}
        </p>
      </CardContent>
    </Card>
  );
}

type RevenueChartPanelsProps = {
  data: ChartPoint[];
  series: CurrencyBarSeries[];
  fullCurrency: (cents: number) => string;
};

function RevenueChartPanels({
  data,
  series,
  fullCurrency,
}: RevenueChartPanelsProps) {
  return (
    <div className="col-span-full mt-2 h-64 min-w-0 sm:h-72">
      {(["all", "services", "products"] as const).map((mode) => (
        <RevenueChart
          key={mode}
          mode={mode}
          data={data}
          series={series}
          fullCurrency={fullCurrency}
        />
      ))}
    </div>
  );
}

type RevenueChartProps = RevenueChartPanelsProps & {
  mode: ChartMode;
};

function RevenueChart({ mode, data, series, fullCurrency }: RevenueChartProps) {
  const visibleSeries =
    mode === "all"
      ? series
      : series.filter((entry) =>
          mode === "services"
            ? entry.dataKey === "servicesCents"
            : entry.dataKey === "productsCents",
        );

  return (
    <TabsContent value={mode} className="h-full">
      <StackedCurrencyBarChart
        data={data}
        xDataKey="weekLabel"
        series={visibleSeries}
        stacked={mode === "all"}
        formatValue={fullCurrency}
        className="h-full"
      />
    </TabsContent>
  );
}
