"use client";

import { CreditCardIcon, EyeIcon, MapPinIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateQuoteRow } from "./corporate-quote-row";
import type { CorporateRequestItem } from "./corporate-requests.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Button } from "~/components/ui/button";

const REQUEST_STATUS_VARIANTS: Record<
  CorporateRequestItem["status"],
  StatusBadgeVariant
> = {
  OPEN: "muted",
  QUOTED: "info",
  ACCEPTED: "success",
  CANCELLED: "muted",
  EXPIRED: "muted",
};

export type CorporateRequestCardProps = {
  request: CorporateRequestItem;
  canMutate: boolean;
  accepting: boolean;
  paying: boolean;
  onAccept: (quoteId: string) => void;
  onPay: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
};

/**
 * One request with the offers it received. Once an offer is accepted the
 * card turns into the order's next step: pay it (unpaid) or open its detail.
 */
export function CorporateRequestCard({
  request,
  canMutate,
  accepting,
  paying,
  onAccept,
  onPay,
  onViewOrder,
}: CorporateRequestCardProps) {
  const t = useTranslations("corporate.orders.requests");
  const categoryT = useTranslations("corporate.requestCategory");
  const formatter = useFormatter();
  const acceptedOrder =
    request.quotes.find((quote) => quote.order !== null)?.order ?? null;
  const openForOffers =
    request.status === "OPEN" || request.status === "QUOTED";
  const pendingQuotes = request.quotes.filter(
    (quote) => quote.status === "PENDING",
  );
  const headingId = `request-${request.id}-title`;

  return (
    <article
      aria-labelledby={headingId}
      className="bg-card flex flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={headingId} className="truncate font-medium">
            {request.title}
          </h3>
          <p className="text-muted-foreground text-copy-sm flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{categoryT(request.category)}</span>
            {request.corporateLocation ? (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon aria-hidden="true" className="size-3.5" />
                {request.corporateLocation.name}
              </span>
            ) : null}
            <time dateTime={request.createdAt.toISOString()}>
              {formatter.dateTime(request.createdAt, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          </p>
        </div>
        <StatusBadge
          status={request.status}
          variantMap={REQUEST_STATUS_VARIANTS}
          label={t(`status.${request.status}`)}
        />
      </header>

      {acceptedOrder ? (
        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-copy-sm">
            {acceptedOrder.status === "PENDING"
              ? t("orderAwaitingPayment", { folio: acceptedOrder.folio })
              : t("orderCreated", { folio: acceptedOrder.folio })}
          </p>
          <div className="flex gap-2">
            {acceptedOrder.status === "PENDING" && canMutate ? (
              <Button
                type="button"
                className="min-h-10"
                disabled={paying}
                onClick={() => onPay(acceptedOrder.id)}
              >
                <CreditCardIcon aria-hidden="true" />
                {t("pay")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => onViewOrder(acceptedOrder.id)}
            >
              <EyeIcon aria-hidden="true" />
              {t("viewOrder")}
            </Button>
          </div>
        </div>
      ) : null}

      {!acceptedOrder && openForOffers ? (
        pendingQuotes.length > 0 ? (
          <section aria-label={t("quotesLabel")} className="border-t">
            <ul className="divide-y">
              {pendingQuotes.map((quote) => (
                <CorporateQuoteRow
                  key={quote.id}
                  quote={quote}
                  canAccept={canMutate}
                  accepting={accepting}
                  onAccept={onAccept}
                />
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-muted-foreground text-copy-sm border-t pt-3">
            {t("waitingForQuotes")}
          </p>
        )
      ) : null}
    </article>
  );
}
