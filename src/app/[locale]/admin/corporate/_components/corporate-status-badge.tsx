"use client";

import { useTranslations } from "next-intl";

import type { CorporateStatusValue } from "./corporate.schema";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const variantMap: Record<CorporateStatusValue, StatusBadgeVariant> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "destructive",
  CANCELLED: "muted",
};

export function CorporateStatusBadge({
  status,
}: {
  status: CorporateStatusValue;
}) {
  const t = useTranslations("admin.corporate.status");

  return (
    <StatusBadge status={status} variantMap={variantMap} label={t(status)} />
  );
}
