import type { LoyaltyBonusStatusValue } from "./payment.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const loyaltyBonusStatusVariantMap = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "muted",
} satisfies Record<LoyaltyBonusStatusValue, StatusBadgeVariant>;

export function LoyaltyBonusStatusBadge({
  status,
  label,
}: {
  status: LoyaltyBonusStatusValue;
  label: string;
}) {
  return (
    <StatusBadge
      status={status}
      variantMap={loyaltyBonusStatusVariantMap}
      label={label}
    />
  );
}
