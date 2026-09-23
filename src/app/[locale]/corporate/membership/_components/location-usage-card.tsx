"use client";

import { useTranslations } from "next-intl";

import type { CorporateMembershipSummary } from "../../_components/corporate.types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Active locations against the tier limit. Both numbers come from the
 * server; nothing is counted here. Without a limit the bar disappears and
 * only the count remains.
 */
export function LocationUsageCard({
  usage,
}: {
  usage: CorporateMembershipSummary["usage"];
}) {
  const t = useTranslations("corporate.membership.usage");
  const percent =
    usage.max === null || usage.max === 0
      ? null
      : Math.min(100, Math.round((usage.used / usage.max) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-copy-sm">{t("description")}</p>
        <p className="text-display-md font-mono tabular-nums">
          {usage.max === null
            ? t("valueUnlimited", { used: usage.used })
            : t("value", { used: usage.used, max: usage.max })}
        </p>
        {percent !== null && usage.max !== null ? (
          <div
            role="progressbar"
            aria-label={t("label")}
            aria-valuemin={0}
            aria-valuemax={usage.max}
            aria-valuenow={usage.used}
            className="bg-canvas-soft-2 h-2 w-full overflow-hidden rounded-full"
          >
            <div
              className="bg-ink h-full w-full rounded-full transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(-${100 - percent}%)` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
