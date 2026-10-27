"use client";

import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useReadOnlyNotice } from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";

/**
 * Replaces the radar and "Mis ofertas" lists while the account cannot quote:
 * both reads go through `activeBusinessProcedure`, so instead of a generic
 * error the business sees why the marketplace is closed for now.
 */
export function QuotingLockedState() {
  const t = useTranslations("dashboard.requests.locked");
  const readOnlyNotice = useReadOnlyNotice();

  return (
    <EmptyState
      icon={LockIcon}
      title={t("title")}
      description={readOnlyNotice}
    />
  );
}
