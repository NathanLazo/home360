"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { PlanChangePreview } from "./subscription.types";
import { useCurrencyFormatter } from "./use-currency-formatter";

/**
 * Explains the proration Stripe calculated.
 *
 * With `create_prorations` nothing is charged now: a positive amount is added
 * to the next invoice and a negative one is a credit in favour of the business.
 * The copy says so explicitly so nobody expects an immediate charge.
 */
export function PlanChangeSummary({ preview }: { preview: PlanChangePreview }) {
  const t = useTranslations("dashboard.subscription");
  const format = useFormatter();
  const currency = useCurrencyFormatter();

  const effectiveAt = format.dateTime(preview.effectiveAt, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <dl className="text-copy-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">
          {preview.prorationCents < 0
            ? t("changeDialog.creditLabel")
            : t("changeDialog.chargeLabel")}
        </dt>
        <dd className="font-mono font-medium tabular-nums">
          {currency(Math.abs(preview.prorationCents))}
        </dd>
      </div>
      <p className="text-muted-foreground">
        {preview.prorationCents < 0
          ? t("changeDialog.creditExplanation", { date: effectiveAt })
          : t("changeDialog.chargeExplanation", { date: effectiveAt })}
      </p>
    </dl>
  );
}
