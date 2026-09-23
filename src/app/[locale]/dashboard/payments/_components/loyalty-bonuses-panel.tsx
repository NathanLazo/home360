"use client";

import { useTranslations } from "next-intl";

import { LoyaltyBonusesTable } from "./loyalty-bonuses-table";
import { PaymentsPanelLoading } from "./payments-panel-states";
import { SectionError } from "~/components/section-error";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export function LoyaltyBonusesPanel() {
  const t = useTranslations("dashboard.payments.bonuses");

  const query = api.payment.listLoyaltyBonuses.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages;
  const responseError = pages?.find((page) => page.error !== null)?.error;
  const errorCode =
    responseError ?? (query.error ? toErrorCode(query.error) : null);
  const bonuses = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-copy-sm max-w-prose">
        {t("intro")}
      </p>

      {query.isPending ? (
        <PaymentsPanelLoading label={t("loading")} columns={5} />
      ) : errorCode ? (
        <SectionError
          title={t("errorTitle")}
          code={errorCode}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <LoyaltyBonusesTable
          bonuses={bonuses}
          hasMore={Boolean(query.hasNextPage)}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
    </div>
  );
}
