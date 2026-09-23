"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { BalanceCards } from "./balance-cards";
import { ConnectOnboardingBanner } from "./connect-onboarding-banner";
import { PaymentsHeaderActions } from "./payments-header-actions";
import { TransactionsTable } from "./transactions-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { TableSkeleton } from "~/components/table-skeleton";
import { api } from "~/trpc/react";

function BalancesLoadingState({ label }: { label: string }) {
  return <KpiRowSkeleton count={3} label={label} className="xl:grid-cols-3" />;
}

function TransactionsLoadingState({ label }: { label: string }) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <TableSkeleton columns={6} rows={8} label={label} />
      </CardContent>
    </Card>
  );
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
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-10"
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
  const transactionsQuery = api.payment.listTransactions.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

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

  const pages = transactionsQuery.data?.pages;
  const transactionsResponseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const transactionsError =
    transactionsResponseError ??
    (transactionsQuery.error ? "UNKNOWN_ERROR" : null);
  const transactions = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );

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

      <section className="flex flex-col gap-3" aria-label={t("transactions")}>
        <h2 className="text-lg font-semibold">{t("transactions")}</h2>

        {transactionsQuery.isPending ? (
          <TransactionsLoadingState label={t("loadingTransactions")} />
        ) : null}

        {!transactionsQuery.isPending && transactionsError !== null ? (
          <EmptyState
            icon={TriangleAlertIcon}
            title={t("transactionsErrorTitle")}
            description={errorsT(transactionsError)}
            action={
              <Button
                type="button"
                className="min-h-11"
                onClick={() => void transactionsQuery.refetch()}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            }
          />
        ) : null}

        {!transactionsQuery.isPending && transactionsError === null ? (
          <TransactionsTable
            transactions={transactions}
            hasMore={Boolean(transactionsQuery.hasNextPage)}
            loadingMore={transactionsQuery.isFetchingNextPage}
            onLoadMore={() => void transactionsQuery.fetchNextPage()}
          />
        ) : null}
      </section>
    </div>
  );
}
