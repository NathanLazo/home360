"use client";

import { DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { InvoiceListItem } from "./subscription.types";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { Button } from "~/components/ui/button";

/**
 * "Última factura: $999 · 15 jul · pagada" plus its download.
 *
 * `pdfUrl` downloads the document; it is not a way to pay an invoice, so the
 * button never doubles as a "settle your debt" call to action.
 */
export function LatestInvoiceSummary({ invoice }: { invoice: InvoiceListItem }) {
  const t = useTranslations("dashboard.subscription.invoices");
  const format = useFormatter();
  const currency = useCurrencyFormatter();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("latestLabel")}</span>
        <span className="font-mono font-medium">
          {currency(invoice.amountCents)}
        </span>
        <span className="text-muted-foreground">
          {format.dateTime(invoice.issuedAt, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <InvoiceStatusBadge
          status={invoice.status}
          label={t(`status.${invoice.status}`)}
        />
      </p>
      {invoice.pdfUrl ? (
        <Button asChild className="min-h-11 sm:min-h-10">
          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
            <DownloadIcon aria-hidden="true" />
            {t("download")}
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          className="min-h-11 sm:min-h-10"
          disabled
          title={t("downloadUnavailable")}
        >
          <DownloadIcon aria-hidden="true" />
          {t("download")}
        </Button>
      )}
    </div>
  );
}
