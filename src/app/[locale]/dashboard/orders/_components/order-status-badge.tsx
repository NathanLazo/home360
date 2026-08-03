import type { OrderListItem } from "./order.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const statusVariantMap = {
  PENDING: "muted",
  PAID: "info",
  IN_PROGRESS: "warning",
  SHIPPING: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
} satisfies Record<OrderListItem["status"], StatusBadgeVariant>;

export function OrderStatusBadge({
  status,
  label,
}: {
  status: OrderListItem["status"];
  label: string;
}) {
  return (
    <StatusBadge status={status} variantMap={statusVariantMap} label={label} />
  );
}
