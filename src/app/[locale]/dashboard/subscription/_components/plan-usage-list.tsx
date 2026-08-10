"use client";

import { useTranslations } from "next-intl";

import type { PlanUsageReport } from "./subscription.types";

const RESOURCES = ["branches", "workers", "products"] as const;

/**
 * Current usage against the limits of the active plan. Both numbers come from
 * the server (`buildPlanUsageReport`); nothing is counted here.
 */
export function PlanUsageList({ usage }: { usage: PlanUsageReport }) {
  const t = useTranslations("dashboard.subscription");

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {RESOURCES.map((resource) => {
        const { used, max } = usage[resource];

        return (
          <div key={resource} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs uppercase">
              {t(`usage.${resource}`)}
            </dt>
            <dd className="font-mono text-sm font-medium">
              {max === null
                ? t("usage.valueUnlimited", { used })
                : t("usage.value", { used, max })}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
