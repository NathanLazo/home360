"use client";

import { CalendarDaysIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { InsightCardSkeleton } from "./insight-card-skeleton";
import { OrderActivityHeatmap } from "./order-activity-heatmap";
import { useDashboardInsights } from "./use-dashboard-insights";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { DashboardRangeDays } from "~/lib/search-params";

export type OrderActivityCardProps = {
  branchId?: string;
  days: DashboardRangeDays;
};

export function OrderActivityCard({ branchId, days }: OrderActivityCardProps) {
  const t = useTranslations("dashboard.home");
  const { state, isRefreshing, retry } = useDashboardInsights(branchId, days);

  if (state.status === "pending") {
    return <InsightCardSkeleton label={t("loadingInsights")} />;
  }

  if (state.status === "error") {
    return (
      <SectionError
        title={t("queryErrorTitle")}
        code={state.code}
        onRetry={retry}
      />
    );
  }

  const { activity } = state.data;
  // The grid spans whole weeks regardless of the range selector.
  const weeks = Math.ceil(activity.length / 7);
  const total = activity.reduce((sum, day) => sum + day.count, 0);

  return (
    <Card aria-busy={isRefreshing}>
      <CardHeader>
        <CardTitle>
          <h2>{t("activityTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("activityDescription", { weeks })}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            headingLevel="h3"
            icon={CalendarDaysIcon}
            title={t("activityEmptyTitle")}
            description={t("activityEmptyDescription")}
          />
        ) : (
          <>
            <OrderActivityHeatmap activity={activity} />
            <p className="sr-only">{t("activitySummary", { total, weeks })}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
