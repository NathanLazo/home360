"use client";

import { useEffect, useState } from "react";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderDetailSheet } from "./order-detail-sheet";
import { OrderFilters } from "./order-filters";
import type { OrderFiltersState } from "./order.types";
import { OrdersTable } from "./orders-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

const INITIAL_FILTERS: OrderFiltersState = {
  search: "",
  status: "",
  type: "",
};

function OrdersLoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function OrdersView({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.orders");
  const errorsT = useTranslations("errors");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchDraft.trim();
      setFilters((current) =>
        current.search === search ? current : { ...current, search },
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  const listInput = {
    ...(branchId ? { branchId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
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
  const orders = pages?.flatMap((page) => page.result?.items ?? []) ?? [];
  const filtered = [
    branchId !== undefined,
    filters.search.length > 0,
    filters.status.length > 0,
    filters.type.length > 0,
  ].some(Boolean);
  const detailResponse = detailQuery.data;
  const detailOrder = detailResponse?.result ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <OrderFilters
        filters={filters}
        searchDraft={searchDraft}
        onSearchChange={(value) => setSearchDraft(value.slice(0, 100))}
        onChange={setFilters}
      />

      {listQuery.isPending ? <OrdersLoadingState label={t("loading")} /> : null}

      {!listQuery.isPending && (listQuery.error || responseError) ? (
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("queryErrorTitle")}
          description={
            responseError ? errorsT(responseError) : t("queryErrorDescription")
          }
          action={
            <Button
              type="button"
              className="min-h-11"
              onClick={() => void listQuery.refetch()}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          }
        />
      ) : null}

      {!listQuery.isPending && !listQuery.error && !responseError ? (
        <OrdersTable
          orders={orders}
          filtered={filtered}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onSelect={(order) => setSelectedOrderId(order.id)}
        />
      ) : null}

      <OrderDetailSheet
        open={selectedOrderId !== null}
        order={detailOrder}
        loading={detailQuery.isPending && selectedOrderId !== null}
        responseError={detailResponse?.error ?? null}
        transportError={detailQuery.error !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedOrderId(null);
        }}
        onRetry={() => void detailQuery.refetch()}
      />
    </div>
  );
}
