"use client";

import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { KpiValue } from "~/components/kpi-value";
import { usdMicrosToUsd } from "~/lib/agent/agent-pricing";

const USD_FORMAT = {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

/**
 * The wallet: one verifiable figure that rolls when a purchase lands
 * (`KpiValue` honours reduced motion) and the screen's single flow entry
 * (`action`: the beam button) beside it.
 */
export function AiBalanceSummary({
  balanceUsdMicros,
  action,
}: {
  balanceUsdMicros: number;
  action?: ReactNode;
}) {
  const t = useTranslations("profile.billing");
  const empty = balanceUsdMicros <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-label font-mono">
            {t("balance")}
          </p>
          <p className="text-display-lg font-mono tabular-nums">
            <KpiValue
              value={usdMicrosToUsd(balanceUsdMicros)}
              format={USD_FORMAT}
            />
          </p>
        </div>
        {action}
      </div>
      {empty ? (
        <p
          className="text-warning-deep text-copy-sm flex items-start gap-2"
          role="status"
        >
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {t("balanceEmpty")}
        </p>
      ) : (
        <p className="text-muted-foreground text-copy-sm">{t("balanceHint")}</p>
      )}
    </div>
  );
}
