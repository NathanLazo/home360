"use client";

import {
  BanknoteIcon,
  InboxIcon,
  LockKeyholeIcon,
  StarIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { KpiCard } from "~/components/kpi-card";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export type KpiRowProps = {
  branchId?: string;
};

export function KpiRow({ branchId }: KpiRowProps) {
  const t = useTranslations("dashboard.home");
  const errors = useTranslations("errors");
  const formatter = useFormatter();
  const input = branchId ? { branchId } : {};
  const query = api.dashboard.getKpis.useQuery(input);
  const response = query.data;

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="bg-accent h-36 animate-pulse rounded-xl motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (query.error || !response || response.error || !response.result) {
    const description = response?.error
      ? errors(response.error)
      : t("queryErrorDescription");

    return (
      <Card role="alert">
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("queryErrorTitle")}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
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
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const revenueDelta =
    data.revenueDeltaPct === null
      ? t("notAvailable")
      : t("revenueComparison", {
          delta: formatter.number(data.revenueDeltaPct / 100, {
            style: "percent",
            signDisplay: "always",
            maximumFractionDigits: 0,
          }),
        });

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("kpisLabel")}
    >
      <KpiCard
        label={t("revenue")}
        value={currency(data.revenueCents)}
        icon={BanknoteIcon}
        delta={{
          text: revenueDelta,
          trend:
            data.revenueDeltaPct === null
              ? "neutral"
              : data.revenueDeltaPct >= 0
                ? "up"
                : "down",
        }}
      />
      <KpiCard
        label={t("orders")}
        value={formatter.number(data.ordersCount)}
        icon={InboxIcon}
        delta={{
          text: t("ordersBreakdown", {
            services: data.serviceOrders,
            products: data.productOrders,
          }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("escrow")}
        value={currency(data.escrowCents)}
        icon={LockKeyholeIcon}
        delta={{
          text: t("escrowOrders", { count: data.escrowOrdersCount }),
          trend: "neutral",
        }}
      />
      <KpiCard
        label={t("rating")}
        value={
          data.avgRating === null
            ? t("notAvailable")
            : formatter.number(data.avgRating, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })
        }
        icon={StarIcon}
        delta={{
          text: t("reviews", { count: data.reviewsCount }),
          trend: "neutral",
        }}
      />
    </section>
  );
}
