"use client";

import { StethoscopeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useMoney } from "./use-money";

/**
 * Two-step charge preview of an offer whose service has a diagnostic: what
 * the customer pays on acceptance and whether it is credited later.
 */
export function OfferDiagnosticNotice({
  id,
  priceCents,
  credited,
}: {
  id: string;
  priceCents: number;
  credited: boolean;
}) {
  const t = useTranslations("dashboard.requests.offerForm");
  const money = useMoney();

  return (
    <div
      id={id}
      className="bg-canvas-soft flex gap-3 rounded-xl border p-4"
      aria-live="polite"
    >
      <StethoscopeIcon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <div className="space-y-1">
        <p className="text-copy-sm font-medium">{t("diagnosticTitle")}</p>
        <p className="text-muted-foreground text-copy-sm text-pretty">
          {t.rich("diagnosticNotice", {
            amount: money(priceCents),
            price: (chunks) => (
              <span className="text-foreground font-mono font-medium tabular-nums">
                {chunks}
              </span>
            ),
          })}{" "}
          {t(credited ? "diagnosticCredited" : "diagnosticNotCredited")}
        </p>
      </div>
    </div>
  );
}
