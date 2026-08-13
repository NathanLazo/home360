"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { RevenueBreakdown } from "./finance.types";
import { DonutDistributionChart } from "~/components/donut-distribution-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export function RevenueBreakdownList({
  breakdown,
}: {
  breakdown: RevenueBreakdown;
}) {
  const t = useTranslations("admin.finance.breakdown");
  const formatter = useFormatter();
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Every figure below — including the net total — arrives already derived by
  // the server (XC-27 projection contract); this component only formats.
  const { totals } = breakdown;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {totals.platformGrossRevenueCents + totals.subscriptionCents > 0 ? (
          <DonutDistributionChart
            data={[
              {
                label: t("platformGrossRevenue"),
                value: totals.platformGrossRevenueCents / 100,
                color: "var(--chart-5)",
              },
              {
                label: t("subscriptions"),
                value: totals.subscriptionCents / 100,
                color: "var(--chart-3)",
              },
            ]}
            centerLabel={t("chartCenterLabel")}
            prefix="$"
            className="mx-auto max-w-52"
          />
        ) : null}
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">
              {t("platformGrossRevenue")}
            </dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(totals.platformGrossRevenueCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">
              {t("subscriptions")}
            </dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(totals.subscriptionCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">
              {t("loyaltyBonuses")}
            </dt>
            <dd className="text-destructive font-mono font-semibold tabular-nums">
              −{currency(totals.loyaltyBonusPaidCents)}
            </dd>
          </div>
        </dl>

        <Separator />

        <div className="flex items-baseline justify-between gap-4">
          <span className="font-medium">{t("net")}</span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {currency(totals.netRevenueCents)}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">
          {t("pendingBonuses", {
            amount: currency(totals.loyaltyBonusPendingCents),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
