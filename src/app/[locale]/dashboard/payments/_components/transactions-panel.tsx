"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  TransactionFiltersState,
  TransactionListItem,
} from "./payment.types";
import { PaymentsPanelLoading } from "./payments-panel-states";
import {
  EMPTY_TRANSACTION_FILTERS,
  TransactionFilters,
} from "./transaction-filters";
import { TransactionDetailSheet } from "./transaction-detail-sheet";
import { TransactionsTable } from "./transactions-table";
import { SectionError } from "~/components/section-error";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export function TransactionsPanel({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.payments");
  const [filters, setFilters] = useState<TransactionFiltersState>(
    EMPTY_TRANSACTION_FILTERS,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionListItem | null>(null);

  const query = api.payment.listTransactions.useInfiniteQuery(
    {
      ...(branchId ? { branchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.method ? { method: filters.method } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  // A domain failure is not an empty payload: rows are read only from pages
  // whose envelope reports no error.
  const pages = query.data?.pages;
  const responseError = pages?.find((page) => page.error !== null)?.error;
  const errorCode =
    responseError ?? (query.error ? toErrorCode(query.error) : null);
  const transactions = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );
  const filtered =
    branchId !== undefined || filters.status !== "" || filters.method !== "";

  function openDetail(transaction: TransactionListItem) {
    setSelected(transaction);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TransactionFilters filters={filters} onChange={setFilters} />
        {branchId ? (
          <p className="text-muted-foreground text-copy-sm">
            {t("filters.branchScoped")}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <PaymentsPanelLoading label={t("loadingTransactions")} columns={7} />
      ) : errorCode ? (
        <SectionError
          title={t("transactionsErrorTitle")}
          code={errorCode}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <TransactionsTable
          transactions={transactions}
          filtered={filtered}
          hasMore={Boolean(query.hasNextPage)}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          onSelect={openDetail}
          onClearFilters={() => setFilters(EMPTY_TRANSACTION_FILTERS)}
        />
      )}

      <TransactionDetailSheet
        open={detailOpen}
        transaction={selected}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
