"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PlanListItem } from "./subscription.types";

/**
 * Commission and the three limits, as checked features. A `null` limit is
 * unlimited; the translation is the only place that word exists.
 */
export function PlanFeatureList({ plan }: { plan: PlanListItem }) {
  const t = useTranslations("dashboard.subscription");

  const limit = (value: number | null) =>
    value === null ? t("unlimited") : String(value);

  const features = [
    t("features.commission", { percent: plan.commissionPct }),
    t("features.branches", { value: limit(plan.maxBranches) }),
    t("features.workers", { value: limit(plan.maxWorkers) }),
    t("features.products", { value: limit(plan.maxProducts) }),
  ];

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <CheckIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
          />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
