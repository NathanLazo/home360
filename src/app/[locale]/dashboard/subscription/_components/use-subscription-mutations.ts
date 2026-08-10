"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { PlanListItem } from "./subscription.types";
import { api } from "~/trpc/react";

/**
 * TanStack's `onSuccess` only means the transport succeeded. The domain outcome
 * lives in the `TrpcResponse` envelope, so every mutation is unwrapped here:
 * `error === null && result !== null` is the only success, a stable code is
 * translated from `errors.json`, and a thrown request is handled by `catch`.
 * A domain code is never read off `TRPCClientError.message`.
 */
function unwrap<TResult>(response: {
  result: TResult | null;
  error: string | null;
}): TResult | null {
  return response.error === null ? response.result : null;
}

export function useSubscriptionMutations() {
  const t = useTranslations("dashboard.subscription");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();

  function reportFailure(code: string | null) {
    toast.error(code === null ? t("unexpectedError") : errorsT(code));
  }

  const changePlanMutation = api.subscription.changePlan.useMutation();
  const portalSessionMutation =
    api.subscription.createPortalSession.useMutation();

  async function changePlan(planCode: PlanListItem["code"]): Promise<boolean> {
    try {
      const response = await changePlanMutation.mutateAsync({ planCode });
      const changed = unwrap(response);

      if (!changed) {
        reportFailure(response.error);
        return false;
      }

      await Promise.all([
        utils.subscription.getCurrent.invalidate(),
        utils.subscription.listPlans.invalidate(),
        utils.subscription.listInvoices.invalidate(),
      ]);
      toast.success(t("changeDialog.success"));

      return true;
    } catch {
      reportFailure(null);
      return false;
    }
  }

  async function openBillingPortal(): Promise<void> {
    try {
      const response = await portalSessionMutation.mutateAsync();
      const session = unwrap(response);

      if (!session) {
        reportFailure(response.error);
        return;
      }

      // The Portal is hosted by Stripe, so this is a full document navigation
      // rather than a client-side route change.
      window.location.href = session.url;
    } catch {
      reportFailure(null);
    }
  }

  return {
    changePlan,
    changingPlan: changePlanMutation.isPending,
    openBillingPortal,
    openingBillingPortal: portalSessionMutation.isPending,
  };
}
