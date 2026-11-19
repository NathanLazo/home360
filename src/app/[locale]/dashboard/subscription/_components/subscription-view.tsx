"use client";

import { useState } from "react";
import { CreditCardIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ChangePlanDialog } from "./change-plan-dialog";
import { ChoosePlanIntro } from "./choose-plan-intro";
import { CurrentPlanBanner } from "./current-plan-banner";
import { InvoicesSection } from "./invoices-section";
import { PlanCards } from "./plan-cards";
import type { PlanListItem } from "./subscription.types";
import { useCheckoutReturn } from "./use-checkout-return";
import { useSubscriptionMutations } from "./use-subscription-mutations";
import {
  useReadOnlyNotice,
  useSubscriptionAccess,
} from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

export function SubscriptionView() {
  const t = useTranslations("dashboard.subscription");
  const errorsT = useTranslations("errors");
  const {
    openBillingPortal,
    openingBillingPortal,
    startCheckout,
    checkoutPlanCode,
  } = useSubscriptionMutations();
  const { isReadOnly, businessStatus } = useSubscriptionAccess();
  const readOnlyNotice = useReadOnlyNotice();
  useCheckoutReturn();

  const [targetPlanCode, setTargetPlanCode] = useState<
    PlanListItem["code"] | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentQuery = api.subscription.getCurrent.useQuery();
  const plansQuery = api.subscription.listPlans.useQuery();

  // A domain failure is not an empty payload: `result` is read only when the
  // envelope reports no error.
  const currentResponse = currentQuery.data;
  const current =
    currentResponse?.error === null ? currentResponse.result : null;
  const currentError =
    currentResponse?.error ?? (currentQuery.error ? "UNKNOWN_ERROR" : null);

  const plansResponse = plansQuery.data;
  const plans =
    plansResponse?.error === null ? (plansResponse.result ?? []) : [];
  const plansError =
    plansResponse?.error ?? (plansQuery.error ? "UNKNOWN_ERROR" : null);

  // No billable plan yet (never subscribed, canceled, or a legacy alta that
  // was never paid): every plan card opens Stripe Checkout instead.
  const currentLoaded = !currentQuery.isPending && currentError === null;
  const needsPlan = currentLoaded && (current === null || current.needsPlan);

  const targetPlanName =
    plans.find((plan) => plan.code === targetPlanCode)?.name ?? null;

  function handleSelectPlan(planCode: PlanListItem["code"]) {
    setTargetPlanCode(planCode);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          needsPlan ? undefined : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void openBillingPortal()}
              disabled={openingBillingPortal}
            >
              <CreditCardIcon aria-hidden="true" />
              {t("actions.manageBilling")}
            </Button>
          )
        }
      />

      {currentQuery.isPending ? (
        <Skeleton className="h-28 w-full rounded-md" />
      ) : null}

      {!currentQuery.isPending && currentError !== null ? (
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("currentErrorTitle")}
          description={errorsT(currentError)}
          action={
            <Button type="button" onClick={() => void currentQuery.refetch()}>
              <RotateCcwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          }
        />
      ) : null}

      {needsPlan ? <ChoosePlanIntro /> : null}

      {current && !needsPlan ? (
        <CurrentPlanBanner subscription={current} />
      ) : null}

      {plansQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-80 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {!plansQuery.isPending && plansError !== null ? (
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("plansErrorTitle")}
          description={errorsT(plansError)}
          action={
            <Button type="button" onClick={() => void plansQuery.refetch()}>
              <RotateCcwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          }
        />
      ) : null}

      {!plansQuery.isPending && plansError === null ? (
        <PlanCards
          plans={plans}
          currentPriceCents={current?.plan.priceCents ?? null}
          // A canceled subscription or a non-ACTIVE business is read-only;
          // the guard rejects the mutation anyway, so the button never leads
          // to a pointless 403.
          canChangePlan={current !== null && !isReadOnly}
          onSelectPlan={handleSelectPlan}
          onManagePlan={() => void openBillingPortal()}
          managing={openingBillingPortal}
          checkout={
            needsPlan
              ? {
                  onChoose: (planCode) => void startCheckout(planCode),
                  pendingPlanCode: checkoutPlanCode,
                  // Only a non-approved business is blocked: missing or
                  // canceled plans are exactly what Checkout fixes.
                  blockedReason:
                    businessStatus === "ACTIVE" ? undefined : readOnlyNotice,
                }
              : null
          }
        />
      ) : null}

      <InvoicesSection />

      <ChangePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        targetPlanCode={targetPlanCode}
        targetPlanName={targetPlanName}
      />
    </div>
  );
}
