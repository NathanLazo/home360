import type { CorporateInvoiceItem } from "../../_components/corporate.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const INVOICE_STATUS_VARIANTS: Record<
  CorporateInvoiceItem["status"],
  StatusBadgeVariant
> = {
  PAID: "success",
  OPEN: "warning",
  VOID: "muted",
};

export function CorporateInvoiceStatusBadge({
  status,
  label,
}: {
  status: CorporateInvoiceItem["status"];
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={INVOICE_STATUS_VARIANTS}
      label={label}
    />
  );
}
