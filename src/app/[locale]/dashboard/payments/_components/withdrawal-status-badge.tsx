import type { WithdrawalStatusValue } from "./payment.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

/**
 * Requested/processing still reserve balance (amber); approved is money out;
 * rejected/failed release the reservation and read as errors; a canceled
 * request is simply history.
 */
const withdrawalStatusVariantMap = {
  REQUESTED: "warning",
  PROCESSING: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  FAILED: "destructive",
  CANCELED: "muted",
} satisfies Record<WithdrawalStatusValue, StatusBadgeVariant>;

export function WithdrawalStatusBadge({
  status,
  label,
}: {
  status: WithdrawalStatusValue;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={withdrawalStatusVariantMap}
      label={label}
    />
  );
}
