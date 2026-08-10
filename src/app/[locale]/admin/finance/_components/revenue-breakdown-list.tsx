"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { RevenueBreakdown } from "./finance.types";
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

  const { totals } = breakdown;
  // Display arithmetic only: every component arrives already aggregated by the
  // server from real LoyaltyBonus, Payment and Invoice rows.
  const netCents =
    totals.commissionCents +
    totals.subscriptionCents -
    totals.loyaltyBonusCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">{t("commission")}</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(totals.commissionCents)}
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
              −{currency(totals.loyaltyBonusCents)}
            </dd>
          </div>
        </dl>

        <Separator />

        <div className="flex items-baseline justify-between gap-4">
          <span className="font-medium">{t("net")}</span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {currency(netCents)}
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
