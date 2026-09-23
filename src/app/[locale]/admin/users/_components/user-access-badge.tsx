"use client";

import { useTranslations } from "next-intl";

import type { UserAccessStatus } from "./users.schema";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const variantMap: Record<UserAccessStatus, StatusBadgeVariant> = {
  active: "success",
  suspended: "destructive",
};

/** Platform access of a customer or worker account. */
export function UserAccessBadge({ status }: { status: UserAccessStatus }) {
  const t = useTranslations("admin.users.accessStatus");

  return (
    <StatusBadge status={status} variantMap={variantMap} label={t(status)} />
  );
}
