"use client";

import { useTranslations } from "next-intl";

import { OrderDetailRow } from "./order-detail-row";
import { OrderStatusBadge } from "./order-status-badge";
import type { OrderDetail } from "./order.types";
import { useMoney } from "./use-money";

type DiagnosticInfo = NonNullable<OrderDetail["diagnostic"]>;

/**
 * Two-step service charge on the order sheet. Diagnostic order: credit terms,
 * estimate and the final charge once issued. Final charge: the diagnostic it
 * came from and the credit already deducted from `amountCents`.
 */
export function OrderDiagnosticSection({
  amountCents,
  diagnostic,
}: {
  amountCents: number;
  diagnostic: DiagnosticInfo;
}) {
  const t = useTranslations("dashboard.orders.detail");
  const statusT = useTranslations("dashboard.orderStatus");
  const money = useMoney();
  const amount = (cents: number) => (
    <span className="font-mono tabular-nums">{money(cents)}</span>
  );

  return (
    <section aria-labelledby="order-diagnostic-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="order-diagnostic-heading"
          className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase"
        >
          {t("diagnosticTitle")}
        </h3>
        <span className="bg-metal text-copy-sm rounded-full px-2.5 py-0.5 font-medium">
          {t(
            diagnostic.stage === "diagnostic"
              ? "stageDiagnostic"
              : "stageFinalCharge",
          )}
        </span>
      </div>

      {diagnostic.stage === "diagnostic" ? (
        <dl className="space-y-3">
          <OrderDetailRow label={t("creditTermLabel")}>
            {t(diagnostic.credited ? "credited" : "notCredited")}
          </OrderDetailRow>
          {diagnostic.estimatedJobCents !== null ? (
            <OrderDetailRow label={t("estimatedJobLabel")}>
              {amount(diagnostic.estimatedJobCents)}
            </OrderDetailRow>
          ) : null}
          <OrderDetailRow label={t("finalChargeLabel")}>
            {diagnostic.finalCharge ? (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span>
                  {t("finalChargeOrder", {
                    folio: diagnostic.finalCharge.folio,
                  })}
                </span>
                {amount(diagnostic.finalCharge.amountCents)}
                <OrderStatusBadge
                  status={diagnostic.finalCharge.status}
                  label={statusT(diagnostic.finalCharge.status)}
                />
              </span>
            ) : (
              <span className="text-muted-foreground font-normal">
                {t("finalChargePending")}
              </span>
            )}
          </OrderDetailRow>
        </dl>
      ) : (
        <dl className="space-y-3">
          <OrderDetailRow label={t("diagnosticOrderLabel")}>
            {t("finalChargeOrder", {
              folio: diagnostic.diagnosticOrder.folio,
            })}
          </OrderDetailRow>
          <OrderDetailRow label={t("diagnosticPaidLabel")}>
            {amount(diagnostic.diagnosticOrder.amountCents)}
          </OrderDetailRow>
          <OrderDetailRow label={t("finalJobLabel")}>
            {amount(amountCents + diagnostic.creditCents)}
          </OrderDetailRow>
          <OrderDetailRow label={t("creditAppliedLabel")}>
            {diagnostic.creditCents > 0 ? (
              <span className="font-mono tabular-nums">
                −{money(diagnostic.creditCents)}
              </span>
            ) : (
              t("notCredited")
            )}
          </OrderDetailRow>
        </dl>
      )}
    </section>
  );
}
