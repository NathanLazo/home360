"use client";

import { AlertTriangle, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { SubscriptionStatus } from "../../../../../generated/prisma";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Link } from "~/i18n/navigation";

type SubscriptionStatusBannerProps = {
  status: SubscriptionStatus | null;
  renewsAt: Date | null;
};

/**
 * Persistent dashboard notice for a subscription that is not healthy.
 *
 * Pure presentation: it receives the state from the layout and holds no
 * business logic. The server guard in `activeBusinessProcedure` is the actual
 * authority; this only explains what the business is seeing.
 */
export function SubscriptionStatusBanner({
  status,
  renewsAt,
}: SubscriptionStatusBannerProps) {
  const t = useTranslations("dashboard.subscriptionBanner");
  const format = useFormatter();

  if (status === null || status === "ACTIVE") {
    return null;
  }

  if (status === "PAST_DUE") {
    return (
      <Alert className="border-amber-500/50 text-amber-900 dark:text-amber-200">
        <AlertTriangle />
        <AlertTitle>{t("pastDue.title")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          <span>
            {renewsAt
              ? t("pastDue.descriptionWithDate", {
                  date: format.dateTime(renewsAt, {
                    day: "numeric",
                    month: "long",
                  }),
                })
              : t("pastDue.description")}
          </span>
          <Link
            href="/dashboard/subscription"
            className="font-medium underline underline-offset-4"
          >
            {t("pastDue.cta")}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <Lock />
      <AlertTitle>{t("canceled.title")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span>{t("canceled.description")}</span>
        <Link
          href="/dashboard/subscription"
          className="font-medium underline underline-offset-4"
        >
          {t("canceled.cta")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
