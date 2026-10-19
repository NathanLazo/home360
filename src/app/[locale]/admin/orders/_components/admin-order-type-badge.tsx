"use client";

import { PackageIcon, StoreIcon, TruckIcon, WrenchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AdminOrderRow } from "./admin-orders.types";
import { Badge } from "~/components/ui/badge";

/**
 * Order type plus, for PRODUCT, how it reaches the customer (D10-1). Icon
 * and text together; never the icon alone.
 */
export function AdminOrderTypeBadge({
  type,
  fulfillmentMethod,
}: {
  type: AdminOrderRow["type"];
  fulfillmentMethod: AdminOrderRow["fulfillmentMethod"];
}) {
  const t = useTranslations("admin.orders");
  const FulfillmentIcon =
    fulfillmentMethod === "PICKUP" ? StoreIcon : TruckIcon;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="gap-1.5">
        {type === "SERVICE" ? (
          <WrenchIcon aria-hidden="true" />
        ) : (
          <PackageIcon aria-hidden="true" />
        )}
        {t(`types.${type}`)}
      </Badge>
      {type === "PRODUCT" && fulfillmentMethod ? (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <FulfillmentIcon aria-hidden="true" />
          {t(`fulfillment.${fulfillmentMethod}`)}
        </Badge>
      ) : null}
    </span>
  );
}
