"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { OrderStatus } from "../../../../../../generated/prisma";
import { CorporateOrderDetailSheet } from "./corporate-order-detail-sheet";
import { CorporateOrderFilters } from "./corporate-order-filters";
import { CorporateOrdersTable } from "./corporate-orders-table";
import type { CorporateOrderItem } from "../../_components/corporate.types";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type CorporateOrdersViewProps = {
  locationId?: string;
  status?: OrderStatus;
};

export function CorporateOrdersView({
  locationId,
  status,
}: CorporateOrdersViewProps) {
  const t = useTranslations("corporate.orders");
  const [selectedOrder, setSelectedOrder] =
    useState<CorporateOrderItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const listInput = {
    ...(locationId ? { locationId } : {}),
    ...(status ? { status } : {}),
  };
  const listQuery = api.corporate.listOrders.useInfiniteQuery(listInput, {
    getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
  });
  const locationsQuery = api.corporate.listLocations.useQuery({
    includeInactive: true,
  });

  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (listQuery.error ? toErrorCode(listQuery.error) : null);
  const orders =
    pages?.flatMap((page) =>
      page.error === null ? (page.result?.items ?? []) : [],
    ) ?? [];
  const locations = (locationsQuery.data?.result?.items ?? []).map(
    (location) => ({ id: location.id, name: location.name }),
  );

  function selectOrder(order: CorporateOrderItem) {
    setSelectedOrder(order);
    setSheetOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <CorporateOrderFilters
        locations={locations}
        locationId={locationId}
        status={status}
      />

      {listQuery.isPending ? (
        <div className="space-y-3" aria-busy="true" role="status">
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {!listQuery.isPending && errorCode !== null ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={errorCode}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!listQuery.isPending && errorCode === null ? (
        <CorporateOrdersTable
          orders={orders}
          filtered={locationId !== undefined || status !== undefined}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onSelect={selectOrder}
        />
      ) : null}

      <CorporateOrderDetailSheet
        open={sheetOpen}
        order={selectedOrder}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
