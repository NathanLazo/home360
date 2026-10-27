"use client";

import { Ban, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BusinessStatus } from "@generated/prisma";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

type BusinessStatusBannerProps = {
  status: BusinessStatus;
};

/**
 * Persistent, non-dismissable notice for a business that is not `ACTIVE`
 * (pending admin approval, suspended or rejected).
 *
 * Pure presentation, same pattern as the payments Connect banner: the layout
 * passes the status and `activeBusinessProcedure` stays the authority. The
 * CTAs of every module read the same status through `useSubscriptionAccess`.
 */
export function BusinessStatusBanner({ status }: BusinessStatusBannerProps) {
  const t = useTranslations("dashboard.businessStatusBanner");

  if (status === "ACTIVE") {
    return null;
  }

  if (status === "PENDING") {
    return (
      <Alert variant="info" role="status">
        <Clock aria-hidden="true" />
        <AlertTitle>{t("pending.title")}</AlertTitle>
        <AlertDescription>{t("pending.description")}</AlertDescription>
      </Alert>
    );
  }

  const key = status === "SUSPENDED" ? "suspended" : "rejected";

  return (
    <Alert variant="destructive">
      <Ban aria-hidden="true" />
      <AlertTitle>{t(`${key}.title`)}</AlertTitle>
      <AlertDescription>{t(`${key}.description`)}</AlertDescription>
    </Alert>
  );
}
