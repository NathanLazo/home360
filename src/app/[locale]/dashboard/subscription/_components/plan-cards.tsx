"use client";

import { useTranslations } from "next-intl";

import { PlanCard } from "./plan-card";
import type { PlanListItem } from "./subscription.types";

type PlanCardsProps = {
  plans: PlanListItem[];
  currentPriceCents: number | null;
  canChangePlan: boolean;
  onSelectPlan: (planCode: PlanListItem["code"]) => void;
  onManagePlan: () => void;
  managing: boolean;
};

/** Grid of the three plans, in commercial order as the server returns them. */
export function PlanCards({
  plans,
  currentPriceCents,
  canChangePlan,
  onSelectPlan,
  onManagePlan,
  managing,
}: PlanCardsProps) {
  const t = useTranslations("dashboard.subscription");
  // The next tier up is the one upgrade the page recommends; it alone gets
  // the metal ring, never every pricier card.
  const recommendedCode =
    currentPriceCents === null
      ? null
      : (plans
          .filter((plan) => plan.priceCents > currentPriceCents)
          .reduce<PlanListItem | null>(
            (best, plan) =>
              best === null || plan.priceCents < best.priceCents ? plan : best,
            null,
          )?.code ?? null);

  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label={t("plansLabel")}>
      {plans.map((plan) => (
        <PlanCard
          key={plan.code}
          plan={plan}
          recommended={plan.code === recommendedCode}
          currentPriceCents={currentPriceCents}
          canChangePlan={canChangePlan}
          onSelectPlan={onSelectPlan}
          onManagePlan={onManagePlan}
          managing={managing}
        />
      ))}
    </section>
  );
}
