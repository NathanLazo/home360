"use client";

import {
  MapPinIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { EMPTY_OFFER, OfferForm, toDateTimeLocal } from "./offer-form";
import type { RadarRequestDetail, WorkerOption } from "./order.types";
import type { OfferFormValues } from "./orders.schema";
import { RequestEvidenceGrid } from "./request-evidence-grid";
import { RequestOwnOffer } from "./request-own-offer";
import { useMoney } from "./use-money";
import { useOfferMutations } from "./use-offer-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

function offerDefaults(request: RadarRequestDetail | null): OfferFormValues {
  const quote = request?.ownQuote;

  if (!quote) return EMPTY_OFFER;

  return {
    workerId: quote.workerId ?? "",
    price: String(quote.amountCents / 100),
    // A past visit time must be re-picked before re-sending.
    scheduledAt:
      quote.scheduledFor && quote.scheduledFor.getTime() > Date.now()
        ? toDateTimeLocal(quote.scheduledFor)
        : "",
    message: quote.message ?? "",
  };
}

function SheetSkeleton() {
  return (
    <div className="space-y-6 p-5" aria-busy="true">
      <Skeleton className="h-20 rounded-md" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square rounded-md" />
        <Skeleton className="aspect-square rounded-md" />
        <Skeleton className="aspect-square rounded-md" />
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}

/**
 * Request detail (N2 on web): customer media, AI diagnosis and price range,
 * approximate zone and distance, the own offer (if any) and the offer form.
 * The exact address stays hidden until the customer accepts (MA-13).
 */
export function RequestDetailSheet({
  requestId,
  branchId,
  workers,
  onOpenChange,
}: {
  requestId: string | null;
  branchId?: string;
  workers: WorkerOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.requests.detail");
  const errorsT = useTranslations("errors");
  const formatter = useFormatter();
  const money = useMoney();
  const { isReadOnly } = useSubscriptionAccess();
  const open = requestId !== null;
  const mutations = useOfferMutations();
  const query = api.radar.getRequest.useQuery(
    { id: requestId ?? "", ...(branchId ? { branchId } : {}) },
    { enabled: open },
  );
  const request = query.data?.result ?? null;
  const errorCode =
    query.data?.error ?? (query.error ? toErrorCode(query.error) : null);
  const ownQuote = request?.ownQuote ?? null;
  // Remount the form only when the stored offer changes, never on a plain
  // background refetch (it would wipe what the user is typing).
  const offerFormKey = ownQuote
    ? `${ownQuote.id}:${ownQuote.status}:${ownQuote.updatedAt.getTime()}`
    : (request?.id ?? "none");
  const submitLabel = t(
    ownQuote?.status === "PENDING"
      ? "updateOffer"
      : ownQuote?.status === "WITHDRAWN"
        ? "resendOffer"
        : "sendOffer",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 py-4 pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg font-medium tracking-tight">
              {request?.title ?? t("title")}
            </SheetTitle>
            {request ? (
              <Badge variant="secondary">{request.category}</Badge>
            ) : null}
          </div>
          <SheetDescription>
            {request
              ? t("postedAt", {
                  date: formatter.relativeTime(request.createdAt),
                })
              : t("description")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2.5 right-3"
              aria-label={t("close")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {query.isPending && open ? <SheetSkeleton /> : null}

          {!query.isPending && errorCode !== null ? (
            <div
              className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center"
              role="alert"
            >
              <TriangleAlertIcon
                aria-hidden="true"
                className="text-error size-8"
              />
              <div className="space-y-1">
                <p className="text-display-sm">{t("loadErrorTitle")}</p>
                <p className="text-muted-foreground text-copy-sm">
                  {errorCode === "NOT_FOUND"
                    ? t("notAvailableAnymore")
                    : errorsT(errorCode)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void query.refetch()}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          ) : null}

          {!query.isPending && request ? (
            <div className="space-y-7 p-5">
              <section aria-labelledby="request-summary-heading">
                <h3
                  id="request-summary-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("summaryTitle")}
                </h3>
                <dl className="text-copy-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
                  <dt className="text-muted-foreground">
                    {t("customerLabel")}
                  </dt>
                  <dd className="text-right font-medium">
                    {request.customerName ?? t("notAvailable")}
                  </dd>
                  <dt className="text-muted-foreground">{t("zoneLabel")}</dt>
                  <dd className="inline-flex items-center justify-end gap-1.5 text-right">
                    <MapPinIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-3.5"
                    />
                    {request.zone.neighborhood ?? t("notAvailable")}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("distanceLabel")}
                  </dt>
                  <dd className="text-right font-mono tabular-nums">
                    {t("distanceValue", {
                      km: formatter.number(request.distanceKm, {
                        maximumFractionDigits: 1,
                      }),
                    })}
                  </dd>
                </dl>
                <p className="text-muted-foreground mt-3 text-xs">
                  {t("privacyHint")}
                </p>
                {request.description ? (
                  <div className="bg-canvas-soft mt-4 rounded-md border p-4">
                    <h4 className="text-copy-sm mb-1 font-medium">
                      {t("customerNoteTitle")}
                    </h4>
                    <p className="text-muted-foreground text-copy-sm leading-relaxed whitespace-pre-wrap">
                      {request.description}
                    </p>
                  </div>
                ) : null}
              </section>

              <Separator />

              <section aria-labelledby="request-ai-heading">
                <h3
                  id="request-ai-heading"
                  className="text-muted-foreground text-label mb-4 inline-flex items-center gap-1.5 font-mono font-medium tracking-wide uppercase"
                >
                  <SparklesIcon aria-hidden="true" className="size-3.5" />
                  {t("aiTitle")}
                </h3>
                <p className="text-copy-sm leading-relaxed">
                  {request.aiDiagnosis ?? t("noDiagnosis")}
                </p>
                <dl className="text-copy-sm mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">
                    {t("priceRangeLabel")}
                  </dt>
                  <dd className="text-right font-mono tabular-nums">
                    {request.aiMinPriceCents !== null &&
                    request.aiMaxPriceCents !== null
                      ? t("priceRangeValue", {
                          min: money(request.aiMinPriceCents),
                          max: money(request.aiMaxPriceCents),
                        })
                      : t("notAvailable")}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("confidenceLabel")}
                  </dt>
                  <dd className="text-right font-mono tabular-nums">
                    {request.aiConfidencePct !== null
                      ? t("confidenceValue", { pct: request.aiConfidencePct })
                      : t("notAvailable")}
                  </dd>
                  <dt className="text-muted-foreground">{t("urgencyLabel")}</dt>
                  <dd className="text-right">
                    {request.aiUrgency
                      ? t(`urgency.${request.aiUrgency}`)
                      : t("notAvailable")}
                  </dd>
                </dl>
              </section>

              <Separator />

              <section aria-labelledby="request-evidence-heading">
                <h3
                  id="request-evidence-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("evidenceTitle")}
                </h3>
                <RequestEvidenceGrid evidence={request.evidence} />
              </section>

              <Separator />

              <section
                aria-labelledby="request-offer-heading"
                className="space-y-4"
              >
                <h3
                  id="request-offer-heading"
                  className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase"
                >
                  {t("offerTitle")}
                </h3>
                {ownQuote ? (
                  <RequestOwnOffer
                    quote={ownQuote}
                    withdrawing={mutations.withdrawing}
                    onWithdraw={mutations.withdraw}
                  />
                ) : null}
                {request.quotable ? (
                  <OfferForm
                    key={offerFormKey}
                    initialValues={offerDefaults(request)}
                    workers={workers}
                    submitting={mutations.submitting}
                    disabled={isReadOnly}
                    submitLabel={submitLabel}
                    onSubmit={(offer) => {
                      // Keep the offer anchored to the radar origin in use, or
                      // to the branch it was first sent from.
                      const offerBranchId = branchId ?? ownQuote?.branchId;
                      return mutations.submit({
                        requestId: request.id,
                        ...(offerBranchId ? { branchId: offerBranchId } : {}),
                        ...offer,
                      });
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground text-copy-sm">
                    {t("notQuotable")}
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
