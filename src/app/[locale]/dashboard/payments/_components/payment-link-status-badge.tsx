import type { PaymentLinkStatusValue } from "./payment.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

/** `CREATING` is info (not shareable yet); an inactive link is history. */
const paymentLinkStatusVariantMap = {
  CREATING: "info",
  ACTIVE: "success",
  INACTIVE: "muted",
} satisfies Record<PaymentLinkStatusValue, StatusBadgeVariant>;

export function PaymentLinkStatusBadge({
  status,
  label,
}: {
  status: PaymentLinkStatusValue;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={paymentLinkStatusVariantMap}
      label={label}
    />
  );
}
