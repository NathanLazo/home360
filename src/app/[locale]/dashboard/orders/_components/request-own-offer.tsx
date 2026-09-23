"use client";

import { useState } from "react";
import { Undo2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { OfferStatusBadge } from "./offer-status-badge";
import type { RadarOwnQuote } from "./order.types";
import { useMoney } from "./use-money";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";

/** The business's own offer on the request, with withdraw when pending. */
export function RequestOwnOffer({
  quote,
  withdrawing,
  onWithdraw,
}: {
  quote: RadarOwnQuote;
  withdrawing: boolean;
  onWithdraw: (quoteId: string) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.requests.ownOffer");
  const statusT = useTranslations("dashboard.requests.offerStatus");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const formatter = useFormatter();
  const money = useMoney();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-copy-sm font-medium">{t("title")}</h4>
        <OfferStatusBadge status={quote.status} label={statusT(quote.status)} />
      </div>
      <dl className="text-copy-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{t("priceLabel")}</dt>
        <dd className="text-right font-mono font-semibold tabular-nums">
          {money(quote.amountCents)}
        </dd>
        <dt className="text-muted-foreground">{t("scheduledLabel")}</dt>
        <dd className="text-right">
          {quote.scheduledFor
            ? formatter.dateTime(quote.scheduledFor, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : t("notAvailable")}
        </dd>
        <dt className="text-muted-foreground">{t("workerLabel")}</dt>
        <dd className="text-right">{quote.workerName ?? t("notAvailable")}</dd>
      </dl>
      {quote.message ? (
        <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-md p-3 whitespace-pre-wrap">
          {quote.message}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {t(`hint.${quote.status}`)}
      </p>
      {quote.status === "PENDING" ? (
        <Button
          type="button"
          variant="outline"
          disabled={withdrawing || isReadOnly}
          title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
          onClick={() => setConfirmOpen(true)}
        >
          <Undo2Icon aria-hidden="true" />
          {t("withdraw")}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("withdrawDialog.title")}
        description={t("withdrawDialog.description")}
        confirmLabel={t("withdrawDialog.confirm")}
        cancelLabel={t("withdrawDialog.cancel")}
        destructive
        loading={withdrawing}
        onConfirm={() =>
          void onWithdraw(quote.id).then((done) => {
            if (done) setConfirmOpen(false);
          })
        }
      />
    </div>
  );
}
