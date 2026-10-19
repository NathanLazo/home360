"use client";

import type { ReactNode } from "react";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  ExternalLinkIcon,
  ScaleIcon,
  StarIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { AdminOrderPhotoGrid } from "./admin-order-photo-grid";
import { AdminOrderStatusBadge } from "./admin-order-status-badge";
import { AdminOrderTimeline } from "./admin-order-timeline";
import { AdminOrderTypeBadge } from "./admin-order-type-badge";
import type { AdminOrderDetail } from "./admin-orders.types";
import { PRESS_SURFACE_CLASS } from "../../_components/admin-motion";
import {
  ADMIN_EYEBROW_CLASS,
  ADMIN_TONE_CLASS,
} from "../../_components/admin-surface";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const LINK_CARD_CLASS = cn(
  "focus-visible:ring-ring hover:bg-canvas-soft text-copy-sm flex items-center justify-between gap-3 rounded-xl border p-3 focus-visible:ring-2 focus-visible:outline-none",
  PRESS_SURFACE_CLASS,
);

const EXTERNAL_LINK_CLASS =
  "text-link-deep inline-flex min-h-6 items-center gap-1 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2";

function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={ADMIN_EYEBROW_CLASS}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="text-copy-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
      {children}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </>
  );
}

/**
 * Full order file for platform support (D10-14): parties, fulfillment,
 * money, evidence (recording, before/after, delivery proof), materials,
 * dispute/review and the event log. Read-only; the pickup code is never
 * exposed here.
 */
export function AdminOrderDetailBody({ detail }: { detail: AdminOrderDetail }) {
  const t = useTranslations("admin.orders.detail");
  const paymentT = useTranslations("admin.paymentStatus");
  const disputeStatusT = useTranslations("admin.disputeStatus");
  const resolutionT = useTranslations("admin.disputes.resolutions");
  const formatter = useFormatter();
  const currency = useCurrencyFormatter();
  const dateTime = (value: Date) =>
    formatter.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const { fulfillment, evidence, payment } = detail;
  const isProduct = detail.type === "PRODUCT";
  const hasPoint =
    fulfillment.deliveryLatitude !== null &&
    fulfillment.deliveryLongitude !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <AdminOrderStatusBadge status={detail.status} />
        <AdminOrderTypeBadge
          type={detail.type}
          fulfillmentMethod={fulfillment.method}
        />
        {detail.corporateAccount ? (
          <Badge variant="outline" className="font-normal">
            {t("corporateBadge", { name: detail.corporateAccount.name })}
          </Badge>
        ) : null}
      </div>

      <DetailSection title={t("summary")}>
        <Facts>
          <Fact label={t("item")}>
            {detail.service
              ? t("serviceItem", {
                  name: detail.service.name,
                  category: detail.service.category,
                })
              : detail.product
                ? t("productItem", {
                    name: detail.product.name,
                    sku: detail.product.sku,
                  })
                : t("notAvailable")}
          </Fact>
          <Fact label={t("quantity")}>
            <span className="font-mono tabular-nums">{detail.quantity}</span>
          </Fact>
          <Fact label={t("amount")}>
            <span className="font-mono font-semibold tabular-nums">
              {currency(detail.amountCents)}
            </span>
          </Fact>
          {detail.quote ? (
            <>
              <Fact label={t("quoteCategory")}>{detail.quote.category}</Fact>
              <Fact label={t("scheduledFor")}>
                {detail.quote.scheduledFor ? (
                  <time
                    dateTime={detail.quote.scheduledFor.toISOString()}
                    suppressHydrationWarning
                  >
                    {dateTime(detail.quote.scheduledFor)}
                  </time>
                ) : (
                  t("notAvailable")
                )}
              </Fact>
            </>
          ) : null}
          <Fact label={t("createdAt")}>
            <time
              dateTime={detail.createdAt.toISOString()}
              suppressHydrationWarning
            >
              {dateTime(detail.createdAt)}
            </time>
          </Fact>
          <Fact label={t("updatedAt")}>
            <time
              dateTime={detail.updatedAt.toISOString()}
              suppressHydrationWarning
            >
              {dateTime(detail.updatedAt)}
            </time>
          </Fact>
        </Facts>
      </DetailSection>

      <Separator />

      <DetailSection title={t("parties")}>
        <ul className="flex flex-col gap-2">
          <li>
            <Link
              href={`/admin/users?tab=customers&customer=${detail.customer.id}`}
              className={LINK_CARD_CLASS}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-muted-foreground text-xs">
                  {t("customer")}
                </span>
                <span className="truncate font-medium">
                  {detail.customer.name ?? t("notAvailable")}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {detail.customer.email ?? t("notAvailable")}
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {t("openProfile")}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/users?tab=businesses&business=${detail.business.id}`}
              className={LINK_CARD_CLASS}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-muted-foreground text-xs">
                  {t("business")}
                </span>
                <span className="truncate font-medium">
                  {detail.business.name}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {detail.branch
                    ? t("branchLine", {
                        name: detail.branch.name,
                        address: detail.branch.address,
                      })
                    : t("noBranch")}
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {t("openProfile")}
              </span>
            </Link>
          </li>
        </ul>
        {detail.type === "SERVICE" ? (
          <Facts>
            <Fact label={t("worker")}>
              {detail.worker?.fullName ?? t("noWorker")}
            </Fact>
          </Facts>
        ) : null}
      </DetailSection>

      <Separator />

      <DetailSection title={t(isProduct ? "fulfillment" : "serviceAddress")}>
        <Facts>
          {isProduct ? (
            <Fact label={t("fulfillmentMethod")}>
              {t(`fulfillmentMethods.${fulfillment.method ?? "DELIVERY"}`)}
            </Fact>
          ) : null}
          {!isProduct || fulfillment.method !== "PICKUP" ? (
            <Fact label={t("address")}>
              {detail.addressLine ?? t("notAvailable")}
            </Fact>
          ) : (
            <Fact label={t("pickupBranch")}>
              {detail.branch
                ? t("branchLine", {
                    name: detail.branch.name,
                    address: detail.branch.address,
                  })
                : t("notAvailable")}
            </Fact>
          )}
          {isProduct && hasPoint ? (
            <Fact label={t("location")}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${fulfillment.deliveryLatitude},${fulfillment.deliveryLongitude}`}
                target="_blank"
                rel="noreferrer"
                className={EXTERNAL_LINK_CLASS}
              >
                {t("openMap")}
                <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              </a>
            </Fact>
          ) : null}
          {isProduct && fulfillment.method === "PICKUP" ? (
            <Fact label={t("pickedUpAt")}>
              {fulfillment.pickedUpAt ? (
                <time
                  dateTime={fulfillment.pickedUpAt.toISOString()}
                  suppressHydrationWarning
                >
                  {dateTime(fulfillment.pickedUpAt)}
                </time>
              ) : (
                t("notYet")
              )}
            </Fact>
          ) : null}
          {isProduct ? (
            <Fact label={t("stockHeld")}>
              <span className="font-mono tabular-nums">
                {t("units", { count: fulfillment.stockHeldQty })}
              </span>
            </Fact>
          ) : null}
        </Facts>
      </DetailSection>

      <Separator />

      <DetailSection title={t("payment")}>
        {payment ? (
          <Facts>
            <Fact label={t("paymentStatus")}>{paymentT(payment.status)}</Fact>
            <Fact label={t("paymentMethod")}>
              {t(`paymentMethods.${payment.method}`)}
            </Fact>
            <Fact label={t("charged")}>
              <span className="font-mono tabular-nums">
                {currency(payment.amountCents)}
              </span>
            </Fact>
            <Fact label={t("providerAmount")}>
              <span className="font-mono tabular-nums">
                {currency(payment.providerAmountCents)}
              </span>
            </Fact>
            <Fact label={t("serviceFee")}>
              <span className="font-mono tabular-nums">
                {currency(payment.serviceFeeCents)}
              </span>
            </Fact>
            <Fact label={t("commission")}>
              <span className="font-mono tabular-nums">
                {currency(payment.commissionCents)}
              </span>
            </Fact>
            <Fact label={t("refunded")}>
              <span className="font-mono tabular-nums">
                {currency(payment.refundedCents)}
              </span>
            </Fact>
            <Fact label={t("escrowReleaseAt")}>
              {payment.escrowReleaseAt ? (
                <time
                  dateTime={payment.escrowReleaseAt.toISOString()}
                  suppressHydrationWarning
                >
                  {dateTime(payment.escrowReleaseAt)}
                </time>
              ) : (
                t("clockNotArmed")
              )}
            </Fact>
            <Fact label={t("releasedAt")}>
              {payment.releasedAt ? (
                <time
                  dateTime={payment.releasedAt.toISOString()}
                  suppressHydrationWarning
                >
                  {dateTime(payment.releasedAt)}
                </time>
              ) : (
                t("notYet")
              )}
            </Fact>
          </Facts>
        ) : (
          <p className="text-muted-foreground text-copy-sm">{t("noPayment")}</p>
        )}
      </DetailSection>

      <Separator />

      <DetailSection
        title={t("evidence")}
        action={
          detail.type === "SERVICE" ? (
            <Badge
              variant="outline"
              className={
                evidence.recording.complete
                  ? ADMIN_TONE_CLASS.success
                  : ADMIN_TONE_CLASS.warning
              }
            >
              {evidence.recording.complete ? (
                <CircleCheckIcon aria-hidden="true" />
              ) : (
                <CircleDashedIcon aria-hidden="true" />
              )}
              {t(
                evidence.recording.complete
                  ? "recordingComplete"
                  : "recordingIncomplete",
              )}
            </Badge>
          ) : null
        }
      >
        {detail.type === "SERVICE" ? (
          <>
            <Facts>
              <Fact label={t("recording")}>
                {evidence.recording.url ? (
                  <a
                    href={evidence.recording.url}
                    target="_blank"
                    rel="noreferrer"
                    className={EXTERNAL_LINK_CLASS}
                  >
                    {t("openRecording")}
                    <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  </a>
                ) : (
                  t("notAvailable")
                )}
              </Fact>
              <Fact label={t("duration")}>
                {evidence.recording.durationSec === null
                  ? t("notAvailable")
                  : t("durationValue", {
                      minutes: Math.floor(evidence.recording.durationSec / 60),
                      seconds: evidence.recording.durationSec % 60,
                    })}
              </Fact>
            </Facts>
            {evidence.recording.justification ? (
              <p className="bg-canvas-soft text-muted-foreground text-copy-sm rounded-xl border p-3 whitespace-pre-wrap">
                {t("justification", {
                  text: evidence.recording.justification,
                })}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminOrderPhotoGrid
                title={t("before")}
                photos={evidence.before}
                emptyLabel={t("noPhotos")}
                photoLabel={(number) => t("beforePhoto", { number })}
                openLabel={(label) => t("openPhoto", { label })}
              />
              <AdminOrderPhotoGrid
                title={t("after")}
                photos={evidence.after}
                emptyLabel={t("noPhotos")}
                photoLabel={(number) => t("afterPhoto", { number })}
                openLabel={(label) => t("openPhoto", { label })}
              />
            </div>
            <div className="bg-canvas-soft rounded-xl border p-3">
              <h4 className="text-copy-sm mb-1 font-medium">
                {t("workNotes")}
              </h4>
              <p className="text-muted-foreground text-copy-sm whitespace-pre-wrap">
                {evidence.workNotes ?? t("noNotes")}
              </p>
            </div>
          </>
        ) : (
          <>
            <AdminOrderPhotoGrid
              title={t("delivery")}
              photos={evidence.delivery}
              emptyLabel={t(
                fulfillment.method === "PICKUP"
                  ? "pickupNoPhotos"
                  : "noDeliveryPhotos",
              )}
              photoLabel={(number) => t("deliveryPhoto", { number })}
              openLabel={(label) => t("openPhoto", { label })}
            />
            {fulfillment.deliveryNote ? (
              <div className="bg-canvas-soft rounded-xl border p-3">
                <h4 className="text-copy-sm mb-1 font-medium">
                  {t("deliveryNote")}
                </h4>
                <p className="text-muted-foreground text-copy-sm whitespace-pre-wrap">
                  {fulfillment.deliveryNote}
                </p>
              </div>
            ) : null}
          </>
        )}
      </DetailSection>

      {detail.materials.length > 0 ? (
        <>
          <Separator />
          <DetailSection title={t("materials")}>
            <ul className="divide-hairline divide-y rounded-xl border">
              {detail.materials.map((material) => (
                <li
                  key={material.id}
                  className="text-copy-sm flex items-center justify-between gap-3 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {material.name}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {t("materialLine", {
                        quantity: material.quantity,
                        unitPrice: currency(material.unitPriceCents),
                      })}
                    </span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {currency(material.quantity * material.unitPriceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </DetailSection>
        </>
      ) : null}

      <Separator />

      <DetailSection title={t("disputeAndReview")}>
        {detail.dispute ? (
          <Link
            href={`/admin/disputes?dispute=${detail.dispute.id}`}
            className={LINK_CARD_CLASS}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ScaleIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {t("disputeLine", {
                    status: disputeStatusT(detail.dispute.status),
                  })}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {detail.dispute.resolution
                    ? resolutionT(detail.dispute.resolution)
                    : t("unresolved")}
                </span>
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {t("openDispute")}
            </span>
          </Link>
        ) : (
          <p className="text-muted-foreground text-copy-sm">{t("noDispute")}</p>
        )}
        {detail.review ? (
          <div className="flex flex-col gap-1.5 rounded-xl border p-3">
            <div
              className="text-warning flex gap-1"
              role="img"
              aria-label={t("rating", { rating: detail.review.rating })}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <StarIcon
                  key={index}
                  aria-hidden="true"
                  className="size-4"
                  fill={
                    detail.review && index < detail.review.rating
                      ? "currentColor"
                      : "none"
                  }
                />
              ))}
            </div>
            <p className="text-muted-foreground text-copy-sm">
              {detail.review.comment ?? t("noReviewComment")}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-copy-sm">{t("noReview")}</p>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title={t("timeline")}>
        <AdminOrderTimeline
          createdAt={detail.createdAt}
          events={detail.timeline}
        />
      </DetailSection>
    </div>
  );
}
