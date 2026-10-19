"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { OrderDetailRow } from "./order-detail-row";
import { OrderFulfillmentBadge } from "./order-fulfillment-badge";
import type { OrderDetail } from "./order.types";
import { SignedPhotoGrid } from "./signed-photo-grid";

const LINK_CLASS =
  "text-link-deep inline-flex min-h-6 items-center gap-1 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * PRODUCT fulfillment (D10-1/D10-2): the method, where the package goes (or
 * which branch hands it over) and the delivery proof the customer sees.
 */
export function OrderFulfillmentSection({ order }: { order: OrderDetail }) {
  const t = useTranslations("dashboard.orders.detail.fulfillment");
  const formatter = useFormatter();
  const method = order.fulfillmentMethod ?? "DELIVERY";
  const hasPoint =
    order.deliveryLatitude !== null && order.deliveryLongitude !== null;

  return (
    <section aria-labelledby="order-fulfillment-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="order-fulfillment-heading"
          className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase"
        >
          {t("title")}
        </h3>
        <OrderFulfillmentBadge method={method} long />
      </div>

      <dl className="space-y-3">
        {method === "DELIVERY" ? (
          <>
            <OrderDetailRow label={t("addressLabel")}>
              {order.addressLine ?? t("notAvailable")}
            </OrderDetailRow>
            {hasPoint ? (
              <OrderDetailRow label={t("mapLabel")}>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryLatitude},${order.deliveryLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className={LINK_CLASS}
                >
                  {t("openMap")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                </a>
              </OrderDetailRow>
            ) : null}
            <OrderDetailRow label={t("shipsFromLabel")}>
              {order.branch?.name ?? t("notAvailable")}
            </OrderDetailRow>
          </>
        ) : (
          <>
            <OrderDetailRow label={t("pickupBranchLabel")}>
              {order.branch?.name ?? t("notAvailable")}
            </OrderDetailRow>
            <OrderDetailRow label={t("pickupAddressLabel")}>
              {order.branch?.address ?? t("notAvailable")}
            </OrderDetailRow>
            <OrderDetailRow label={t("pickedUpLabel")}>
              {order.pickedUpAt ? (
                <time dateTime={order.pickedUpAt.toISOString()}>
                  {formatter.dateTime(order.pickedUpAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              ) : (
                t("notPickedUp")
              )}
            </OrderDetailRow>
          </>
        )}
      </dl>

      {method === "DELIVERY" ? (
        <div className="mt-5 space-y-3">
          <h4 className="text-copy-sm font-medium">{t("evidenceTitle")}</h4>
          <SignedPhotoGrid
            photos={order.deliveryEvidence}
            emptyLabel={t("noEvidence")}
            photoLabel={(number) => t("evidencePhoto", { number })}
            openLabel={(label) => t("openPhoto", { label })}
          />
          {order.deliveryNote ? (
            <div className="bg-canvas-soft rounded-xl border p-4">
              <h5 className="text-copy-sm mb-1 font-medium">
                {t("noteTitle")}
              </h5>
              <p className="text-muted-foreground text-copy-sm leading-relaxed whitespace-pre-wrap">
                {order.deliveryNote}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
