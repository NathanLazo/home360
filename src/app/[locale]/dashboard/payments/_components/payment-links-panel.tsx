"use client";

import { useTranslations } from "next-intl";

import { PaymentLinksTable } from "./payment-links-table";
import { PaymentsPanelLoading } from "./payments-panel-states";
import { SectionError } from "~/components/section-error";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export function PaymentLinksPanel({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("dashboard.payments.paymentLinks");

  const query = api.payment.listPaymentLinks.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages;
  const responseError = pages?.find((page) => page.error !== null)?.error;
  const errorCode =
    responseError ?? (query.error ? toErrorCode(query.error) : null);
  const paymentLinks = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );

  if (query.isPending) {
    return <PaymentsPanelLoading label={t("loading")} columns={6} />;
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
    <PaymentLinksTable
      paymentLinks={paymentLinks}
      hasMore={Boolean(query.hasNextPage)}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onCreate={onCreate}
    />
  );
}
