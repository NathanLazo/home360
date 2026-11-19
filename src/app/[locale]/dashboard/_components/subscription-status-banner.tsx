"use client";

import { AlertTriangle, CreditCard, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppFormatter } from "~/i18n/use-app-formatter";

import type { SubscriptionStatus } from "@generated/prisma";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Link } from "~/i18n/navigation";

type SubscriptionStatusBannerProps = {
  /** No billable plan yet: the business must pick one through Checkout. */
  needsPlan: boolean;
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
  needsPlan,
  status,
  renewsAt,
}: SubscriptionStatusBannerProps) {
  const t = useTranslations("dashboard.subscriptionBanner");
  const format = useAppFormatter();

  // Checked first: a legacy `PAST_DUE` that never paid is not "a pending
  // payment" to the business, it is a plan still to be chosen.
  if (needsPlan) {
    return (
      <Alert variant="info" role="status">
        <CreditCard aria-hidden="true" />
        <AlertTitle>{t("choosePlan.title")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          <span>{t("choosePlan.description")}</span>
          <Link
            href="/dashboard/subscription"
            className="font-medium underline underline-offset-4"
          >
            {t("choosePlan.cta")}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === null || status === "ACTIVE") {
    return null;
  }

  if (status === "PAST_DUE") {
    return (
      <Alert variant="warning">
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
