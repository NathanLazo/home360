"use client";

import { useTranslations } from "next-intl";

import type { BusinessDerivedStatus } from "./users.schema";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const variantMap: Record<BusinessDerivedStatus, StatusBadgeVariant> = {
  active: "success",
  pending: "warning",
  in_dispute: "destructive",
  suspended: "muted",
  rejected: "muted",
};

export function BusinessStatusBadge({
  status,
}: {
  status: BusinessDerivedStatus;
}) {
  const t = useTranslations("admin.users.derivedStatus");

  return (
    <StatusBadge status={status} variantMap={variantMap} label={t(status)} />
  );
}
