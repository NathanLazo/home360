"use client";

import { useTranslations } from "next-intl";

import type { AdminOrderStatusValue } from "./admin-orders.schema";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

/** Same tones as the business order book, so both panels read alike. */
const statusVariantMap = {
  PENDING: "muted",
  PAID: "info",
  IN_PROGRESS: "warning",
  SHIPPING: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
} satisfies Record<AdminOrderStatusValue, StatusBadgeVariant>;

export function AdminOrderStatusBadge({
  status,
}: {
  status: AdminOrderStatusValue;
}) {
  const t = useTranslations("admin.orderStatus");

  return (
    <StatusBadge
      status={status}
      variantMap={statusVariantMap}
      label={t(status)}
    />
  );
}
