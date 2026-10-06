"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { OrderPipeline } from "./dashboard.types";
import {
  FunnelChart,
  type FunnelStage,
} from "~/components/charts/funnel-chart";
import { useIsMobileViewport } from "~/hooks/use-media-query";

export type OrderPipelineChartProps = {
  pipeline: OrderPipeline;
};

/**
 * Cumulative order funnel. Vertical on phones so every stage keeps a full
 * row for its label; horizontal from `sm` up, where width is cheap.
 */
export function OrderPipelineChart({ pipeline }: OrderPipelineChartProps) {
  const t = useTranslations("dashboard.home");
  const formatter = useFormatter();
  const isMobile = useIsMobileViewport();
  const stages: FunnelStage[] = [
    { label: t("pipelineCreated"), value: pipeline.created },
    { label: t("pipelinePaid"), value: pipeline.paid },
    { label: t("pipelineStarted"), value: pipeline.started },
    { label: t("pipelineCompleted"), value: pipeline.completed },
  ];

  return (
    <div aria-hidden="true" className="h-72 min-w-0 sm:h-56">
      <FunnelChart
        key={isMobile ? "vertical" : "horizontal"}
        data={stages}
        orientation={isMobile ? "vertical" : "horizontal"}
        color="var(--chart-1)"
        layers={3}
        gap={4}
        grid={{ bands: true, lines: false }}
        formatValue={(value) => formatter.number(value)}
        formatPercentage={(pct) =>
          formatter.number(pct / 100, {
            style: "percent",
            maximumFractionDigits: 0,
          })
        }
        className="h-full w-full"
      />
    </div>
  );
}
