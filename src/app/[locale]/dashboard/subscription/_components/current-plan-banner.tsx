"use client";

import { useFormatter, useTranslations } from "next-intl";

import { PlanUsageList } from "./plan-usage-list";
import type { CurrentSubscription } from "./subscription.types";
import { Card, CardContent } from "~/components/ui/card";

/**
 * "Plan actual: Estándar · renueva el 15 ago" plus current usage.
 *
 * `renewsAt` is the period end Stripe reported; it is provisional until the
 * first billing webhook arrives (F3-F4-findings #20), so the copy states the
 * renewal date without promising anything about payment.
 */
export function CurrentPlanBanner({
  subscription,
}: {
  subscription: CurrentSubscription;
}) {
  const t = useTranslations("dashboard.subscription");
  const format = useFormatter();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="text-copy-sm">
          <span className="font-semibold">
            {t("currentPlan", { plan: subscription.plan.name })}
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {t("renewsOn", {
              date: format.dateTime(subscription.renewsAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </span>
        </p>
        <PlanUsageList usage={subscription.usage} />
      </CardContent>
    </Card>
  );
}
