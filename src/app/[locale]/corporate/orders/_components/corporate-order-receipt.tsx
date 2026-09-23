"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { CorporateOrderDetail } from "./corporate-requests.types";

const CURRENCY = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export type CorporateOrderReceiptProps = {
  amounts: CorporateOrderDetail["amounts"];
  payment: CorporateOrderDetail["payment"];
};

/** Receipt: labor + service fee = total, payment state and dates. */
export function CorporateOrderReceipt({
  amounts,
  payment,
}: CorporateOrderReceiptProps) {
  const t = useTranslations("corporate.orders.detail.receipt");
  const paymentT = useTranslations("corporate.paymentStatus");
  const formatter = useFormatter();
  const money = (cents: number) => formatter.number(cents / 100, CURRENCY);
  const rows: Array<[string, string]> = [
    [t("labor"), money(amounts.laborCents)],
    [t("serviceFee"), money(amounts.serviceFeeCents)],
  ];

  if (amounts.refundedCents > 0) {
    rows.push([t("refunded"), `−${money(amounts.refundedCents)}`]);
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="text-copy-sm flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t pt-1.5 font-medium">
          <dt>{t("total")}</dt>
          <dd className="font-mono tabular-nums">
            {money(amounts.totalCents)}
          </dd>
        </div>
      </dl>
      <p className="text-copy-sm">
        {payment
          ? t("paymentState", {
              status: paymentT(payment.status),
              date: formatter.dateTime(payment.paidAt, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
            })
          : t("unpaid")}
      </p>
      {payment?.releasedAt ? (
        <p className="text-muted-foreground text-xs">
          {t("releasedAt", {
            date: formatter.dateTime(payment.releasedAt, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          })}
        </p>
      ) : null}
    </div>
  );
}
