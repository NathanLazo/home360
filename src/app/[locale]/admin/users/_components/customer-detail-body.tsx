"use client";

import { StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PRESS_SURFACE_CLASS } from "../../_components/admin-motion";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { SheetDetailSection } from "./sheet-detail-section";
import { UserAccessBadge } from "./user-access-badge";
import type { CustomerDetail } from "./users.types";
import { Separator } from "~/components/ui/separator";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export function CustomerDetailBody({ detail }: { detail: CustomerDetail }) {
  const t = useTranslations("admin.users.customerDetail");
  const orderStatusT = useTranslations("admin.orderStatus");
  const disputeStatusT = useTranslations("admin.disputeStatus");
  const formatter = useFormatter();
  const currency = useCurrencyFormatter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <UserAccessBadge status={detail.accessStatus} />
      </div>

      {detail.accessStatus === "suspended" ? (
        <p className="bg-canvas-soft text-muted-foreground text-copy-sm rounded-xl border p-3">
          {detail.suspensionReason
            ? t("suspendedReason", { reason: detail.suspensionReason })
            : t("suspendedNoReason")}
        </p>
      ) : null}

      <SheetDetailSection title={t("profile")}>
        <dl className="text-copy-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">{t("email")}</dt>
          <dd className="min-w-0 truncate">
            {detail.email ?? t("notAvailable")}
          </dd>
          <dt className="text-muted-foreground">{t("registeredAt")}</dt>
          <dd suppressHydrationWarning>
            {formatter.dateTime(detail.createdAt, { dateStyle: "medium" })}
          </dd>
          <dt className="text-muted-foreground">{t("language")}</dt>
          <dd className="font-mono uppercase">{detail.locale}</dd>
          <dt className="text-muted-foreground">{t("addresses")}</dt>
          <dd className="font-mono tabular-nums">{detail.addressesCount}</dd>
        </dl>
      </SheetDetailSection>

      <Separator />

      <SheetDetailSection
        title={t("recentOrders", { count: detail.ordersCount })}
      >
        {detail.recentOrders.length === 0 ? (
          <p className="text-muted-foreground text-copy-sm">{t("noOrders")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.recentOrders.map((order) => (
              <li
                key={order.id}
                className="text-copy-sm flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{order.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {t("orderMeta", {
                      folio: order.folio,
                      status: orderStatusT(order.status),
                      business: order.businessName,
                    })}
                  </span>
                </div>
                <span className="font-mono font-semibold tabular-nums">
                  {currency(order.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetDetailSection>

      <Separator />

      <SheetDetailSection title={t("reviews", { count: detail.reviews.count })}>
        {detail.reviews.averageRating !== null ? (
          <p className="text-copy-sm flex items-center gap-1.5">
            <StarIcon
              aria-hidden="true"
              className="text-muted-foreground size-4"
            />
            {t("averageRating", {
              rating: formatter.number(detail.reviews.averageRating, {
                maximumFractionDigits: 1,
              }),
            })}
          </p>
        ) : null}
        {detail.reviews.items.length === 0 ? (
          <p className="text-muted-foreground text-copy-sm">{t("noReviews")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.reviews.items.map((review) => (
              <li
                key={review.id}
                className="text-copy-sm flex flex-col gap-1 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">
                    {review.businessName}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {t("rating", { rating: review.rating })}
                  </span>
                </div>
                {review.comment ? (
                  <p className="text-muted-foreground text-xs text-pretty">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetDetailSection>

      <Separator />

      <SheetDetailSection
        title={t("disputes", { count: detail.disputes.count })}
      >
        {detail.disputes.items.length === 0 ? (
          <p className="text-muted-foreground text-copy-sm">
            {t("noDisputes")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.disputes.items.map((dispute) => (
              <li key={dispute.id}>
                <Link
                  href={`/admin/disputes?dispute=${dispute.id}`}
                  className={cn(
                    "focus-visible:ring-ring hover:bg-canvas-soft text-copy-sm flex items-center justify-between gap-3 rounded-xl border p-3 focus-visible:ring-2 focus-visible:outline-none",
                    PRESS_SURFACE_CLASS,
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {dispute.title}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {dispute.businessName}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {disputeStatusT(dispute.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SheetDetailSection>
    </div>
  );
}
