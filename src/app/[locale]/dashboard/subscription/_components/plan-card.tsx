"use client";

import { useTranslations } from "next-intl";

import { PlanFeatureList } from "./plan-feature-list";
import type { PlanListItem } from "./subscription.types";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

type PlanCardProps = {
  plan: PlanListItem;
  /** The next tier up: its upgrade button carries the page's metal ring. */
  recommended: boolean;
  /** `null` while the current subscription is still unknown. */
  currentPriceCents: number | null;
  canChangePlan: boolean;
  onSelectPlan: (planCode: PlanListItem["code"]) => void;
  onManagePlan: () => void;
  managing: boolean;
};

/**
 * One plan of the grid. The button depends on the relation with the current
 * plan: the active one manages billing, a cheaper one downgrades and a pricier
 * one upgrades.
 */
export function PlanCard({
  plan,
  recommended,
  currentPriceCents,
  canChangePlan,
  onSelectPlan,
  onManagePlan,
  managing,
}: PlanCardProps) {
  const t = useTranslations("dashboard.subscription");
  const currency = useCurrencyFormatter();

  const isUpgrade =
    currentPriceCents !== null && plan.priceCents > currentPriceCents;

  function renderAction() {
    // "Manage plan" stays enabled even in read-only: the Billing Portal is the
    // only way a canceled business can add a card or resume (PENDIENTES.md §8).
    if (plan.isCurrent) {
      return (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:min-h-10"
          onClick={onManagePlan}
          disabled={managing}
        >
          {t("actions.manage")}
        </Button>
      );
    }

    const actionable = canChangePlan && plan.isAvailable;

    return (
      <Button
        metal={recommended && isUpgrade && actionable ? "bend" : "static"}
        metalClassName="w-full"
        type="button"
        variant={isUpgrade ? "default" : "outline"}
        className="min-h-11 w-full sm:min-h-10"
        onClick={() => onSelectPlan(plan.code)}
        disabled={!canChangePlan || !plan.isAvailable}
        title={
          !plan.isAvailable
            ? t("actions.unavailableHint")
            : canChangePlan
              ? undefined
              : t("readOnly.actionDisabled")
        }
      >
        {isUpgrade
          ? t("actions.upgrade")
          : t("actions.switchTo", { plan: plan.name })}
      </Button>
    );
  }

  return (
    <Card
      className={cn(plan.isCurrent && "border-primary ring-primary/20 ring-1")}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{plan.name}</CardTitle>
          {plan.isCurrent ? <Badge>{t("currentPlanTag")}</Badge> : null}
        </div>
        <CardDescription className="text-foreground text-display-md font-mono tabular-nums">
          {currency(plan.priceCents)}
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            {t("perMonth")}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PlanFeatureList plan={plan} />
      </CardContent>
      <CardFooter>{renderAction()}</CardFooter>
    </Card>
  );
}
