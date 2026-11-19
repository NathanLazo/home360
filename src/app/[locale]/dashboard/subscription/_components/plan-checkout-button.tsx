"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PlanListItem } from "./subscription.types";
import { Button } from "~/components/ui/button";

export type PlanCheckoutAction = {
  onChoose: (planCode: PlanListItem["code"]) => void;
  /** Plan whose Checkout is being opened; every button waits meanwhile. */
  pendingPlanCode: PlanListItem["code"] | null;
  /** Translated reason when the business cannot subscribe yet. */
  blockedReason: string | undefined;
};

/**
 * "Choose plan" for a business without a billable plan: opens the Stripe
 * Checkout of that plan, where it pays or redeems a promotion code.
 */
export function PlanCheckoutButton({
  plan,
  recommended,
  action,
}: {
  plan: PlanListItem;
  recommended: boolean;
  action: PlanCheckoutAction;
}) {
  const t = useTranslations("dashboard.subscription");
  const pending = action.pendingPlanCode === plan.code;
  const disabled =
    !plan.isAvailable ||
    action.blockedReason !== undefined ||
    action.pendingPlanCode !== null;

  return (
    <Button
      metal={recommended && !disabled ? "bend" : "static"}
      metalClassName="w-full"
      type="button"
      variant={recommended ? "default" : "outline"}
      className="w-full"
      onClick={() => action.onChoose(plan.code)}
      disabled={disabled}
      aria-busy={pending || undefined}
      title={
        !plan.isAvailable ? t("actions.unavailableHint") : action.blockedReason
      }
    >
      {pending ? (
        <Loader2Icon
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}
      {t("actions.choose", { plan: plan.name })}
    </Button>
  );
}
