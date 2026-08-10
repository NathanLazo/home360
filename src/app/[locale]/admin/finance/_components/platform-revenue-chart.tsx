"use client";

import { BarChart3Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { RevenuePoint } from "./finance.types";
import { EmptyState } from "~/components/empty-state";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
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

  const config = {
    commissionCents: {
      label: t("commission"),
      color: "var(--foreground)",
    },
    subscriptionCents: {
      label: t("subscriptions"),
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 min-w-0 sm:h-72">
          <ChartContainer config={config} className="aspect-auto h-full w-full">
            <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
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
                          {config[String(name) as keyof typeof config]?.label}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {fullCurrency(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="commissionCents"
                fill="var(--color-commissionCents)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="subscriptionCents"
                fill="var(--color-subscriptionCents)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
