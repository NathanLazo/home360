import type { InvoiceStatusValue } from "./subscription.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

/**
 * Exhaustive `InvoiceStatus` -> variant map; `satisfies` turns a new Prisma
 * status into a compile error instead of an unstyled badge.
 *
 * Stripe's `uncollectible` is stored as `OPEN` because the local enum has no
 * separate value for bad debt, so `OPEN` must read as "unpaid", never as a
 * promise that the invoice is still collectible.
 */
const invoiceStatusVariantMap = {
  PAID: "success",
  OPEN: "warning",
  VOID: "muted",
} satisfies Record<InvoiceStatusValue, StatusBadgeVariant>;

export function InvoiceStatusBadge({
  status,
  label,
}: {
  status: InvoiceStatusValue;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={invoiceStatusVariantMap}
      label={label}
    />
  );
}
