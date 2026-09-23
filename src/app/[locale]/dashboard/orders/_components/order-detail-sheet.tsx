"use client";

import {
  CircleCheckIcon,
  CircleDashedIcon,
  ExternalLinkIcon,
  ImageIcon,
  RotateCcwIcon,
  StarIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { OrderStatusBadge } from "./order-status-badge";
import { OrderTimeline } from "./order-timeline";
import type { OrderDetail } from "./order.types";
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
import { UserAvatar } from "~/components/user-avatar";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-copy-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-5" aria-busy="true">
      <Skeleton className="h-24 rounded-md" />
      <Skeleton className="h-40 rounded-md" />
      <Skeleton className="h-56 rounded-md" />
      <Skeleton className="h-40 rounded-md" />
    </div>
  );
}

export function OrderDetailSheet({
  open,
  order,
  loading,
  responseError,
  transportError,
  onOpenChange,
  onRetry,
}: {
  open: boolean;
  order: OrderDetail | null;
  loading: boolean;
  responseError: string | null;
  transportError: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("dashboard.orders.detail");
  const statusT = useTranslations("dashboard.orderStatus");
  const errorsT = useTranslations("errors");
  const formatter = useFormatter();
  const locale = useLocale();
  const exactCurrencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const integerFormatter = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const exactCurrency = (cents: bigint) => {
    const negative = cents < BigInt(0);
    const absolute = negative ? -cents : cents;
    const whole = absolute / BigInt(100);
    const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
    const parts = exactCurrencyFormatter.formatToParts(negative ? -0.01 : 0);

    return parts
      .map((part) => {
        if (part.type === "integer") return integerFormatter.format(whole);
        if (part.type === "fraction") return fraction;
        return part.value;
      })
      .join("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 py-4 pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-mono text-lg font-medium tracking-tight tabular-nums">
              {order ? `#${order.folio}` : t("title")}
            </SheetTitle>
            {order ? (
              <OrderStatusBadge
                status={order.status}
                label={statusT(order.status)}
              />
            ) : null}
          </div>
          <SheetDescription>
            {order?.title ?? t("description")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2.5 right-3 min-h-11 min-w-11"
              aria-label={t("close")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? <DetailSkeleton /> : null}

          {!loading && (transportError || responseError || !order) ? (
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
                  {responseError
                    ? errorsT(responseError)
                    : t("loadErrorDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={onRetry}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          ) : null}

          {!loading && order ? (
            <div className="space-y-7 p-5">
              <section aria-labelledby="order-overview-heading">
                <h3
                  id="order-overview-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("overviewTitle")}
                </h3>
                <dl className="space-y-3">
                  <DetailRow label={t("customerLabel")}>
                    {order.customer.email ? (
                      <span className="inline-flex items-center justify-end gap-2">
                        <UserAvatar
                          seed={order.customer.email}
                          name={order.customer.name ?? order.customer.email}
                          size={20}
                        />
                        {order.customer.name ?? t("notAvailable")}
                      </span>
                    ) : (
                      (order.customer.name ?? t("notAvailable"))
                    )}
                  </DetailRow>
                  <DetailRow label={t("emailLabel")}>
                    {order.customer.email ?? t("notAvailable")}
                  </DetailRow>
                  <DetailRow label={t("branchLabel")}>
                    {order.branch?.name ?? t("noBranch")}
                  </DetailRow>
                  <DetailRow label={t("itemLabel")}>
                    {order.type === "SERVICE"
                      ? (order.service?.name ?? t("notAvailable"))
                      : (order.product?.name ?? t("notAvailable"))}
                  </DetailRow>
                  <DetailRow label={t("typeLabel")}>
                    {t(
                      order.type === "SERVICE" ? "typeService" : "typeProduct",
                    )}
                  </DetailRow>
                  <DetailRow label={t("quantityLabel")}>
                    <span className="font-mono tabular-nums">
                      {order.quantity}
                    </span>
                  </DetailRow>
                </dl>
              </section>

              <Separator />

              <section aria-labelledby="order-payment-heading">
                <h3
                  id="order-payment-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("paymentTitle")}
                </h3>
                <dl className="space-y-3">
                  <DetailRow label={t("totalLabel")}>
                    <span className="font-mono tabular-nums">
                      {currency(order.amountCents)}
                    </span>
                  </DetailRow>
                  {order.payment ? (
                    <>
                      <DetailRow label={t("commissionLabel")}>
                        <span className="font-mono tabular-nums">
                          {currency(order.payment.commissionCents)}
                        </span>
                      </DetailRow>
                      <DetailRow label={t("paymentMethodLabel")}>
                        {t(`paymentMethod.${order.payment.method}`)}
                      </DetailRow>
                      <DetailRow label={t("paymentStatusLabel")}>
                        {t(`paymentStatus.${order.payment.status}`)}
                      </DetailRow>
                    </>
                  ) : (
                    <DetailRow label={t("paymentStatusLabel")}>
                      {t("noPayment")}
                    </DetailRow>
                  )}
                </dl>
              </section>

              <Separator />

              <section aria-labelledby="order-evidence-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="order-evidence-heading"
                    className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase"
                  >
                    {t("evidenceTitle")}
                  </h3>
                  <Badge
                    variant="outline"
                    className={
                      order.recordingComplete
                        ? "bg-success-soft text-success-deep border-transparent"
                        : "bg-warning-soft text-warning-deep border-transparent"
                    }
                  >
                    {order.recordingComplete ? (
                      <CircleCheckIcon aria-hidden="true" />
                    ) : (
                      <CircleDashedIcon aria-hidden="true" />
                    )}
                    {t(
                      order.recordingComplete
                        ? "recordingComplete"
                        : "recordingIncomplete",
                    )}
                  </Badge>
                </div>

                <dl className="space-y-3">
                  <DetailRow label={t("durationLabel")}>
                    {order.recordingDurationSec === null
                      ? t("notAvailable")
                      : t("durationValue", {
                          minutes: Math.floor(order.recordingDurationSec / 60),
                          seconds: order.recordingDurationSec % 60,
                        })}
                  </DetailRow>
                  <DetailRow label={t("recordingLabel")}>
                    {order.recordingUrl ? (
                      <a
                        href={order.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link-deep inline-flex min-h-6 items-center gap-1 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {t("openRecording")}
                        <ExternalLinkIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </a>
                    ) : (
                      t("notAvailable")
                    )}
                  </DetailRow>
                </dl>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <EvidenceGallery
                    title={t("beforeTitle")}
                    urls={order.beforeUrls}
                    emptyLabel={t("noBeforePhotos")}
                    photoLabel={(number) => t("beforePhoto", { number })}
                  />
                  <EvidenceGallery
                    title={t("afterTitle")}
                    urls={order.afterUrls}
                    emptyLabel={t("noAfterPhotos")}
                    photoLabel={(number) => t("afterPhoto", { number })}
                  />
                </div>

                <div className="bg-canvas-soft mt-4 rounded-md border p-4">
                  <h4 className="text-copy-sm mb-1 font-medium">
                    {t("notesTitle")}
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {order.workNotes ?? t("noNotes")}
                  </p>
                </div>
              </section>

              <Separator />

              <section aria-labelledby="order-materials-heading">
                <h3
                  id="order-materials-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("materialsTitle")}
                </h3>
                {order.materials.length > 0 ? (
                  <ul className="divide-hairline divide-y rounded-md border">
                    {order.materials.map((material) => (
                      <li
                        key={material.id}
                        className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {material.name}
                          </p>
                          <p className="text-muted-foreground font-mono text-xs tabular-nums">
                            {t("materialCalculation", {
                              quantity: material.quantity,
                              unitPrice: currency(material.unitPriceCents),
                            })}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {exactCurrency(
                            BigInt(material.quantity) *
                              BigInt(material.unitPriceCents),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-copy-sm">
                    {t("noMaterials")}
                  </p>
                )}
              </section>

              <Separator />

              <section aria-labelledby="order-review-heading">
                <h3
                  id="order-review-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("reviewTitle")}
                </h3>
                {order.review ? (
                  <div className="space-y-2 rounded-md border p-4">
                    <div
                      className="text-warning flex gap-1"
                      aria-label={t("ratingLabel", {
                        rating: order.review.rating,
                      })}
                    >
                      {Array.from({ length: 5 }, (_, index) => (
                        <StarIcon
                          key={index}
                          aria-hidden="true"
                          className="size-4"
                          fill={
                            index < order.review!.rating
                              ? "currentColor"
                              : "none"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {order.review.comment ?? t("noReviewComment")}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-copy-sm">
                    {t("noReview")}
                  </p>
                )}
              </section>

              <Separator />

              <section aria-labelledby="order-timeline-heading">
                <h3
                  id="order-timeline-heading"
                  className="text-muted-foreground text-label mb-4 font-mono font-medium tracking-wide uppercase"
                >
                  {t("timelineTitle")}
                </h3>
                <OrderTimeline order={order} />
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EvidenceGallery({
  title,
  urls,
  emptyLabel,
  photoLabel,
}: {
  title: string;
  urls: string[];
  emptyLabel: string;
  photoLabel: (number: number) => string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-copy-sm font-medium">{title}</h4>
      {urls.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="bg-canvas-soft hover:bg-canvas-soft-2 hover:border-hairline-strong focus-visible:ring-ring flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border p-2 text-center text-xs font-medium transition-[background-color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
              >
                <ImageIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-5"
                />
                {photoLabel(index + 1)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-copy-sm">{emptyLabel}</p>
      )}
    </div>
  );
}
