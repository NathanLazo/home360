"use client";

import { FunnelIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { InsightCardSkeleton } from "./insight-card-skeleton";
import { OrderPipelineChart } from "./order-pipeline-chart";
import { useDashboardInsights } from "./use-dashboard-insights";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { DashboardRangeDays } from "~/lib/search-params";

export type OrderPipelineCardProps = {
  branchId?: string;
  days: DashboardRangeDays;
};

export function OrderPipelineCard({ branchId, days }: OrderPipelineCardProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
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

  const { pipeline } = state.data;
  const rate =
    pipeline.created === 0 ? 0 : pipeline.completed / pipeline.created;

  return (
    <Card aria-busy={isRefreshing}>
      <CardHeader>
        <CardTitle>
          <h2>{t("pipelineTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("pipelineDescription", { days })}</CardDescription>
        {pipeline.created > 0 ? (
          <CardAction>
            <span className="text-label text-muted-foreground rounded-full border px-2 py-0.5 font-mono tabular-nums">
              {t("pipelineConversion", {
                rate: formatter.number(rate, {
                  style: "percent",
                  maximumFractionDigits: 0,
                }),
              })}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {pipeline.created === 0 ? (
          <EmptyState
            headingLevel="h3"
            icon={FunnelIcon}
            title={t("pipelineEmptyTitle")}
            description={t("pipelineEmptyDescription")}
          />
        ) : (
          <>
            <OrderPipelineChart pipeline={pipeline} />
            <p className="sr-only">{t("pipelineSummary", pipeline)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
