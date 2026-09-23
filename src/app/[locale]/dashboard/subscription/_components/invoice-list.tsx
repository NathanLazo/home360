"use client";

import { DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { InvoiceListItem } from "./subscription.types";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { Button } from "~/components/ui/button";

/**
 * Previous invoices, one download per row. There is no bulk download: Stripe
 * does not offer an archive, and inventing a client-side one would be a lie.
 */
export function InvoiceList({ invoices }: { invoices: InvoiceListItem[] }) {
  const t = useTranslations("dashboard.subscription.invoices");
  const format = useFormatter();
  const currency = useCurrencyFormatter();

  if (invoices.length === 0) {
    return null;
  }

  return (
    <ul className="divide-hairline divide-y rounded-md border">
      {invoices.map((invoice) => (
        <li
          key={invoice.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <span className="text-muted-foreground text-copy-sm">
            {format.dateTime(invoice.issuedAt, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="text-copy-sm font-mono tabular-nums">
            {currency(invoice.amountCents)}
          </span>
          <InvoiceStatusBadge
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-9"
              disabled
              title={t("downloadUnavailable")}
            >
              <DownloadIcon aria-hidden="true" />
              {t("download")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
