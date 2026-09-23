"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { OrderDetailSheet } from "./order-detail-sheet";
import { OrderFilters } from "./order-filters";
import type { OrderFiltersState } from "./order.types";
import { OrdersTable } from "./orders-table";
import { toOrderListDateRange } from "./order-date-range";
import { SectionError } from "~/components/section-error";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

const INITIAL_FILTERS: OrderFiltersState = {
  search: "",
  status: "",
  type: "",
  workerId: "",
  from: "",
  to: "",
};

function OrdersLoadingState({ label }: { label: string }) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <TableSkeleton columns={9} rows={8} label={label} />
      </CardContent>
    </Card>
  );
}

export function OrdersPanel({
  branchId,
  selectedOrderId,
  onOpenOrder,
  onCloseOrder,
}: {
  branchId?: string;
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
  onCloseOrder: () => void;
}) {
  const t = useTranslations("dashboard.orders");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchDraft.trim();
      setFilters((current) =>
        current.search === search ? current : { ...current, search },
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  const workersQuery = api.service.listWorkers.useQuery();
  const workers = workersQuery.data?.result ?? [];
  const dateRange = toOrderListDateRange(filters.from, filters.to);
  const listInput = {
    ...(branchId ? { branchId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.workerId ? { workerId: filters.workerId } : {}),
    ...dateRange,
  };
  const listQuery = api.order.list.useInfiniteQuery(listInput, {
    getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
  });
  const detailQuery = api.order.getById.useQuery(
    { id: selectedOrderId ?? "" },
    { enabled: selectedOrderId !== null },
  );
  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (listQuery.error ? toErrorCode(listQuery.error) : null);
  const orders = pages?.flatMap((page) => page.result?.items ?? []) ?? [];
  const filtered = [
    branchId !== undefined,
    filters.search.length > 0,
    filters.status.length > 0,
    filters.type.length > 0,
    filters.workerId.length > 0,
    filters.from.length > 0,
    filters.to.length > 0,
  ].some(Boolean);
  const detailResponse = detailQuery.data;

  return (
    <>
      <OrderFilters
        filters={filters}
        workers={workers}
        searchDraft={searchDraft}
        onSearchChange={(value) => setSearchDraft(value.slice(0, 100))}
        onChange={setFilters}
      />

      {listQuery.isPending ? <OrdersLoadingState label={t("loading")} /> : null}

      {!listQuery.isPending && errorCode !== null ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={errorCode}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!listQuery.isPending && errorCode === null ? (
        <OrdersTable
          orders={orders}
          filtered={filtered}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onSelect={(order) => onOpenOrder(order.id)}
          onClearFilters={
            filtered
              ? () => {
                  setSearchDraft("");
                  setFilters(INITIAL_FILTERS);
                }
              : undefined
          }
        />
      ) : null}

      <OrderDetailSheet
        open={selectedOrderId !== null}
        order={detailResponse?.result ?? null}
        workers={workers}
        loading={detailQuery.isPending && selectedOrderId !== null}
        responseError={detailResponse?.error ?? null}
        transportError={detailQuery.error !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseOrder();
        }}
        onRetry={() => void detailQuery.refetch()}
      />
    </>
  );
}
