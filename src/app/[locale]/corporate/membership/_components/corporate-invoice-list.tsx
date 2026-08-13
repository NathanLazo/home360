"use client";

import { DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateInvoiceStatusBadge } from "./corporate-invoice-status-badge";
import type { CorporateInvoiceItem } from "../../_components/corporate.types";
import { Button } from "~/components/ui/button";

/**
 * One download per row, straight to the Stripe-hosted PDF. Without a
 * `pdfUrl` the action is disabled and explained — never a dead link.
 */
export function CorporateInvoiceList({
  invoices,
}: {
  invoices: CorporateInvoiceItem[];
}) {
  const t = useTranslations("corporate.membership.invoices");
  const format = useFormatter();

  if (invoices.length === 0) {
    return null;
  }

  return (
    <ul className="divide-border divide-y rounded-lg border">
      {invoices.map((invoice) => (
        <li
          key={invoice.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <span className="text-muted-foreground text-sm">
            {format.dateTime(invoice.issuedAt, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="font-mono text-sm tabular-nums">
            {format.number(invoice.amountCents / 100, {
              style: "currency",
              currency: "MXN",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <CorporateInvoiceStatusBadge
            status={invoice.status}
            label={t(`status.${invoice.status}`)}
          />
          {invoice.pdfUrl ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-9"
            >
              <a
                href={invoice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadIcon aria-hidden="true" />
                {t("download")}
              </a>
            </Button>
          ) : (
            <span title={t("downloadUnavailable")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 sm:min-h-9"
                disabled
              >
                <DownloadIcon aria-hidden="true" />
                {t("download")}
                <span className="sr-only">{t("downloadUnavailable")}</span>
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
