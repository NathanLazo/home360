import type { CorporateOrderStatus } from "./corporate.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const ORDER_STATUS_VARIANTS: Record<CorporateOrderStatus, StatusBadgeVariant> =
  {
    PENDING: "muted",
    PAID: "info",
    IN_PROGRESS: "info",
    SHIPPING: "info",
    COMPLETED: "success",
    CANCELLED: "muted",
    DISPUTED: "destructive",
  };

export function CorporateOrderStatusBadge({
  status,
  label,
}: {
  status: CorporateOrderStatus;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={ORDER_STATUS_VARIANTS}
      label={label}
    />
  );
}
