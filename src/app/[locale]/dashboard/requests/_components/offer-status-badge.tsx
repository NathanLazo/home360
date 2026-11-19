import type { MyQuoteItem } from "./request.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const statusVariantMap = {
  PENDING: "info",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "muted",
  WITHDRAWN: "warning",
} satisfies Record<MyQuoteItem["status"], StatusBadgeVariant>;

export function OfferStatusBadge({
  status,
  label,
}: {
  status: MyQuoteItem["status"];
  label: string;
}) {
  return (
    <StatusBadge status={status} variantMap={statusVariantMap} label={label} />
  );
}
