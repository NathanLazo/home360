import { StoreIcon, TruckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrderDetail } from "./order.types";
import { Badge } from "~/components/ui/badge";

type FulfillmentMethod = NonNullable<OrderDetail["fulfillmentMethod"]>;

/**
 * How a PRODUCT order reaches the customer (D10-1). Icon + text, never the
 * icon alone; `long` spells it out for the detail sheet.
 */
export function OrderFulfillmentBadge({
  method,
  long = false,
}: {
  method: FulfillmentMethod;
  long?: boolean;
}) {
  const t = useTranslations("dashboard.orders.fulfillment");
  const Icon = method === "PICKUP" ? StoreIcon : TruckIcon;

  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Icon aria-hidden="true" />
      {t(long ? `long.${method}` : `short.${method}`)}
    </Badge>
  );
}
