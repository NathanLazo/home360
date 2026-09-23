"use client";

import { useTranslations } from "next-intl";

import { PaymentsPanelLoading } from "./payments-panel-states";
import { WithdrawalsTable } from "./withdrawals-table";
import { SectionError } from "~/components/section-error";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export function WithdrawalsPanel() {
  const t = useTranslations("dashboard.payments.withdrawals");

  const query = api.payment.listWithdrawals.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages;
  const responseError = pages?.find((page) => page.error !== null)?.error;
  const errorCode =
    responseError ?? (query.error ? toErrorCode(query.error) : null);
  const withdrawals = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );

  if (query.isPending) {
    return <PaymentsPanelLoading label={t("loading")} columns={5} />;
  }

  if (errorCode) {
    return (
      <SectionError
        title={t("errorTitle")}
        code={errorCode}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <WithdrawalsTable
      withdrawals={withdrawals}
      hasMore={Boolean(query.hasNextPage)}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
    />
  );
}
