import type { PaymentStatusValue } from "./payment.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

/**
 * Exhaustive `PaymentStatus` -> variant map. `satisfies Record<...>` makes a
 * new Prisma status a compile error instead of a silently unstyled badge.
 * `PENDING` is blue (money authorized, nothing captured) and must never read
 * as paid; the in-flight `RELEASING` / `REFUNDING` states share the amber of
 * `IN_ESCROW` because the funds are still held.
 */
const paymentStatusVariantMap = {
  PENDING: "info",
  IN_ESCROW: "warning",
  RELEASING: "warning",
  RELEASED: "success",
  REFUNDING: "warning",
  REFUNDED: "muted",
  PARTIALLY_REFUNDED: "muted",
} satisfies Record<PaymentStatusValue, StatusBadgeVariant>;

export function PaymentStatusBadge({
  status,
  label,
}: {
  status: PaymentStatusValue;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={paymentStatusVariantMap}
      label={label}
    />
  );
}
