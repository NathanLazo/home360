"use client";

import { HistoryIcon, InboxIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ADMIN_TABLE_CARD_CLASS } from "../../_components/admin-surface";
import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { SectionHeading } from "../../_components/section-heading";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "../../_components/table-skeleton";
import type { WithdrawalView } from "./finance.schema";
import type { WithdrawalHistoryFilters as Filters } from "./finance.types";
import { useWithdrawalMutations } from "./use-withdrawal-mutations";
import { WithdrawalHistoryFilters } from "./withdrawal-history-filters";
import { WithdrawalsTable } from "./withdrawals-table";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

const SEARCH_DEBOUNCE_MS = 300;

const SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-36" },
  { width: "w-24", align: "end" },
  { width: "w-28" },
  { width: "w-20" },
  { width: "w-20" },
  { width: "w-32", align: "end" },
];

const EMPTY_FILTERS: Filters = { status: null, business: "", from: "", to: "" };

/**
 * W12 withdrawals. The default view is the approval queue ("Por aprobar",
 * REQUESTED only, oldest first); "Ver historial" swaps it for everything
 * already decided or in flight, with its own filters.
 */
export function WithdrawalsSection() {
  const t = useTranslations("admin.finance.withdrawals");
  const [view, setView] = useState<WithdrawalView>("pending");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const business = useDebouncedValue(
    filters.business.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const mutations = useWithdrawalMutations();

  const history = view === "history";
  const query = api.admin.finance.listWithdrawals.useInfiniteQuery(
    history
      ? {
          view,
          ...(filters.status ? { status: filters.status } : {}),
          ...(business.length > 0 ? { business } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        }
      : { view },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages ?? [];
  const errorCode =
    pages.find((page) => page.error !== null)?.error ??
    (query.error ? toErrorCode(query.error) : null);
  const withdrawals = pages.flatMap((page) => page.result?.items ?? []);
  const filtered =
    history &&
    (filters.status !== null ||
      business.length > 0 ||
      filters.from.length > 0 ||
      filters.to.length > 0);

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="admin-finance-withdrawals"
    >
      <SectionHeading
        id="admin-finance-withdrawals"
        title={history ? t("historyTitle") : t("pendingTitle")}
        description={
          history ? t("historyDescription") : t("pendingDescription")
        }
        action={
          <Button
            type="button"
            variant="outline"
            aria-pressed={history}
            onClick={() => setView(history ? "pending" : "history")}
          >
            {history ? (
              <InboxIcon aria-hidden="true" />
            ) : (
              <HistoryIcon aria-hidden="true" />
            )}
            {history ? t("showPending") : t("showHistory")}
          </Button>
        }
      />

      {history ? (
        <WithdrawalHistoryFilters filters={filters} onChange={setFilters} />
      ) : null}

      {query.isPending ? (
        <TableSkeleton
          columns={SKELETON_COLUMNS}
          rows={5}
          label={t("loading")}
        />
      ) : null}

      {!query.isPending && errorCode !== null ? (
        <SectionError
          title={t("errorTitle")}
          code={errorCode}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isPending && errorCode === null ? (
        <Card className={ADMIN_TABLE_CARD_CLASS}>
          <CardContent className="px-0">
            <WithdrawalsTable
              withdrawals={withdrawals}
              pending={mutations.pending}
              onApprove={(withdrawalId) => mutations.approve({ withdrawalId })}
              onRetry={(withdrawalId) => mutations.retry({ withdrawalId })}
              onReject={mutations.reject}
              emptyTitle={history ? t("empty.historyTitle") : t("empty.title")}
              emptyDescription={
                history ? t("empty.historyDescription") : t("empty.description")
              }
              emptyAction={
                filtered ? (
                  <ClearFiltersButton
                    onClear={() => setFilters(EMPTY_FILTERS)}
                  />
                ) : undefined
              }
            />
          </CardContent>
          {query.hasNextPage ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
