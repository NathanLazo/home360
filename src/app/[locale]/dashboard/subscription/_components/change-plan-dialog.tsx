"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PlanChangeSummary } from "./plan-change-summary";
import { PlanLimitExceededList } from "./plan-limit-exceeded-list";
import type { PlanListItem } from "./subscription.types";
import { useSubscriptionMutations } from "./use-subscription-mutations";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

type ChangePlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlanCode: PlanListItem["code"] | null;
  targetPlanName: string | null;
};

/**
 * Confirms a plan change against the real proration Stripe reports.
 *
 * A downgrade that does not fit is blocked here with the exact list of what
 * exceeds the target plan; the `PLAN_LIMIT_REACHED` failure of `changePlan` is
 * only the server-side safety net.
 */
export function ChangePlanDialog({
  open,
  onOpenChange,
  targetPlanCode,
  targetPlanName,
}: ChangePlanDialogProps) {
  const t = useTranslations("dashboard.subscription.changeDialog");
  const errorsT = useTranslations("errors");
  const { changePlan, changingPlan } = useSubscriptionMutations();

  const previewQuery = api.subscription.previewChange.useQuery(
    { planCode: targetPlanCode ?? "basic" },
    { enabled: open && targetPlanCode !== null, staleTime: 30_000 },
  );

  const response = previewQuery.data;
  const preview = response?.error === null ? response.result : null;
  const previewError =
    response?.error ?? (previewQuery.error ? "UNKNOWN_ERROR" : null);
  const canConfirm = preview !== null && preview.fits && !changingPlan;

  async function handleConfirm() {
    if (!targetPlanCode) {
      return;
    }

    const changed = await changePlan(targetPlanCode);

    if (changed) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {targetPlanName
              ? t("title", { plan: targetPlanName })
              : t("titleFallback")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {previewQuery.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true" role="status">
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : null}

        {!previewQuery.isPending && previewError !== null ? (
          <p className="text-error-deep text-copy-sm" role="alert">
            {errorsT(previewError)}
          </p>
        ) : null}

        {preview ? (
          <div className="flex flex-col gap-4">
            <PlanLimitExceededList exceeds={preview.exceeds} />
            {preview.fits ? <PlanChangeSummary preview={preview} /> : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="min-h-11 sm:min-h-10"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {changingPlan ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
