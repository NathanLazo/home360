"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { WeeklyRevenuePoint } from "./dashboard.types";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
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
  const query = api.dashboard.getWeeklyRevenue.useQuery(input);
  const response = query.data;

  if (query.isPending) {
    return (
      <Card className={className} aria-busy="true">
        <CardHeader>
          <div className="bg-accent h-5 w-44 animate-pulse rounded motion-reduce:animate-none" />
        </CardHeader>
        <CardContent>
          <div className="bg-accent h-64 animate-pulse rounded-lg motion-reduce:animate-none" />
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
            <p className="text-muted-foreground text-sm">
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
  const chartConfig = {
    servicesCents: {
      label: t("servicesTab"),
      color: "var(--foreground)",
    },
    productsCents: {
      label: t("productsTab"),
      color: "var(--muted-foreground)",
    },
  } satisfies ChartConfig;
  const compactCurrency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      notation: "compact",
      maximumFractionDigits: 1,
    });
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
            config={chartConfig}
            compactCurrency={compactCurrency}
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
  config: ChartConfig;
  compactCurrency: (cents: number) => string;
  fullCurrency: (cents: number) => string;
};

function RevenueChartPanels({
  data,
  config,
  compactCurrency,
  fullCurrency,
}: RevenueChartPanelsProps) {
  return (
    <div className="col-span-full mt-2 h-64 min-w-0 sm:h-72">
      {(["all", "services", "products"] as const).map((mode) => (
        <RevenueChart
          key={mode}
          mode={mode}
          data={data}
          config={config}
          compactCurrency={compactCurrency}
          fullCurrency={fullCurrency}
        />
      ))}
    </div>
  );
}

type RevenueChartProps = RevenueChartPanelsProps & {
  mode: ChartMode;
};

function RevenueChart({
  mode,
  data,
  config,
  compactCurrency,
  fullCurrency,
}: RevenueChartProps) {
  return (
    <TabsContent value={mode} className="h-full">
      <ChartContainer config={config} className="aspect-auto h-full w-full">
        <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value: number) => compactCurrency(value)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex min-w-40 items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {fullCurrency(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          {mode !== "products" ? (
            <Bar
              dataKey="servicesCents"
              stackId={mode === "all" ? "revenue" : undefined}
              fill="var(--color-servicesCents)"
              radius={mode === "all" ? [0, 0, 3, 3] : [4, 4, 0, 0]}
            />
          ) : null}
          {mode !== "services" ? (
            <Bar
              dataKey="productsCents"
              stackId={mode === "all" ? "revenue" : undefined}
              fill="var(--color-productsCents)"
              radius={[4, 4, 0, 0]}
            />
          ) : null}
        </BarChart>
      </ChartContainer>
    </TabsContent>
  );
}
