"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { BalanceCards } from "./balance-cards";
import { ConnectOnboardingBanner } from "./connect-onboarding-banner";
import { PaymentsHeaderActions } from "./payments-header-actions";
import { PaymentsTabs } from "./payments-tabs";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { api } from "~/trpc/react";

function BalancesLoadingState({ label }: { label: string }) {
  return <KpiRowSkeleton count={4} label={label} />;
}

function SectionError({
  title,
  description,
  retryLabel,
  onRetry,
}: {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <Card role="alert">
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground text-copy-sm">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
        >
          <RotateCcwIcon aria-hidden="true" />
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PaymentsView() {
  const t = useTranslations("dashboard.payments");
  const errorsT = useTranslations("errors");

  const balancesQuery = api.payment.getBalances.useQuery();
  // F3-12 debt: the commission card shows the percentage of the active plan.
  // Read over tRPC, never by importing another module's `_components`.
  const subscriptionQuery = api.subscription.getCurrent.useQuery();
  // A domain failure is not an empty payload: data is read only from
  // `result` and only when the envelope reports no error. Fields are never
  // read off the envelope root.
  const balancesResponse = balancesQuery.data;
  const balances =
    balancesResponse?.error === null ? balancesResponse.result : null;
  const balancesError =
    balancesResponse?.error ?? (balancesQuery.error ? "UNKNOWN_ERROR" : null);

  const subscriptionResponse = subscriptionQuery.data;
  const commissionPct =
    subscriptionResponse?.error === null
      ? (subscriptionResponse.result?.plan.commissionPct ?? null)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <PaymentsHeaderActions
            availableCents={balances?.availableCents ?? null}
          />
        }
      />

      <ConnectOnboardingBanner />

      {balancesQuery.isPending ? (
        <BalancesLoadingState label={t("loadingBalances")} />
      ) : null}

      {!balancesQuery.isPending && (balancesError !== null || !balances) ? (
        <SectionError
          title={t("balancesErrorTitle")}
          description={
            balancesError !== null
              ? errorsT(balancesError)
              : t("balancesErrorDescription")
          }
          retryLabel={t("retry")}
          onRetry={() => void balancesQuery.refetch()}
        />
      ) : null}

      {!balancesQuery.isPending && balancesError === null && balances ? (
        <BalanceCards balances={balances} commissionPct={commissionPct} />
      ) : null}

      <PaymentsTabs />
    </div>
  );
}
