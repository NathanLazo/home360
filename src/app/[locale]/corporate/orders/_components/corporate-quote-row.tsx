"use client";

import { CheckIcon, StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { CorporateRequestItem } from "./corporate-requests.types";
import { Button } from "~/components/ui/button";

type CorporateQuote = CorporateRequestItem["quotes"][number];

const CURRENCY = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export type CorporateQuoteRowProps = {
  quote: CorporateQuote;
  canAccept: boolean;
  accepting: boolean;
  onAccept: (quoteId: string) => void;
};

/** One provider offer: price, schedule, rating and the accept action. */
export function CorporateQuoteRow({
  quote,
  canAccept,
  accepting,
  onAccept,
}: CorporateQuoteRowProps) {
  const t = useTranslations("corporate.orders.requests");
  const formatter = useFormatter();

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{quote.business.name}</span>
        <span className="text-muted-foreground text-copy-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <StarIcon aria-hidden="true" className="size-3.5" />
            {quote.business.ratingAvg === null
              ? t("noRating")
              : t("rating", {
                  rating: formatter.number(quote.business.ratingAvg, {
                    maximumFractionDigits: 1,
                  }),
                  count: quote.business.ratingCount,
                })}
          </span>
          {quote.scheduledFor ? (
            <time dateTime={quote.scheduledFor.toISOString()}>
              {t("scheduledFor", {
                date: formatter.dateTime(quote.scheduledFor, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </time>
          ) : null}
        </span>
        {quote.message ? (
          <span className="text-copy-sm text-pretty">{quote.message}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <span className="font-mono font-medium tabular-nums">
          {formatter.number(quote.amountCents / 100, CURRENCY)}
        </span>
        {quote.status === "PENDING" && canAccept ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            disabled={accepting}
            onClick={() => onAccept(quote.id)}
            aria-label={t("acceptAria", { business: quote.business.name })}
          >
            <CheckIcon aria-hidden="true" />
            {t("accept")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
