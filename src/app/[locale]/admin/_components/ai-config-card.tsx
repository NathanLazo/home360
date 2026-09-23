"use client";

import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { AiConfigSummary } from "./overview.types";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Link } from "~/i18n/navigation";

export function AiConfigCard({ config }: { config: AiConfigSummary }) {
  const t = useTranslations("admin.overview");
  const formatter = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {t("ai.title")}
        </CardTitle>
        <CardAction>
          <SparklesIcon
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">
              {t("ai.threshold")}
            </dt>
            <dd className="font-mono text-lg font-semibold tabular-nums">
              {formatter.number(config.confidenceThresholdPct / 100, {
                style: "percent",
                maximumFractionDigits: 0,
              })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">{t("ai.model")}</dt>
            <dd className="font-mono text-sm font-medium">
              {config.pricingModel}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground text-sm">
              {t("ai.humanReview")}
            </dt>
            <dd className="text-sm font-medium">
              {config.humanReviewBelowThreshold
                ? t("ai.humanReviewOn")
                : t("ai.humanReviewOff")}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-xs">
          {t("ai.updatedAt", {
            when: formatter.relativeTime(config.updatedAt),
          })}
        </p>
        <Button
          asChild
          variant="outline"
          className="group min-h-11 justify-between transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
        >
          <Link href="/admin/settings">
            {t("ai.openSettings")}
            <ArrowRightIcon
              aria-hidden="true"
              className="transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
