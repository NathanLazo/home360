"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { PlusIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ServiceFilters } from "./service-filters";
import { ServiceFormSheet } from "./service-form-sheet";
import type { ServiceFiltersState, ServiceListItem } from "./service.types";
import { ServicesSkeleton } from "./services-skeleton";
import { ServicesTable } from "./services-table";
import { useServiceMutations } from "./use-service-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

const INITIAL_FILTERS: ServiceFiltersState = {
  search: "",
  category: "",
  status: "",
};

export function ServicesView() {
  const t = useTranslations("dashboard.services");
  const errors = useTranslations("errors");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceListItem | null>(null);
  const input = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const listQuery = api.service.list.useInfiniteQuery(input, {
    getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    // Filter changes keep the current rows on screen instead of flashing the
    // full-page skeleton; the skeleton is reserved for the first load.
    placeholderData: keepPreviousData,
  });
  const categoriesQuery = api.service.listCategories.useQuery();
  const workersQuery = api.service.listWorkers.useQuery();
  const mutations = useServiceMutations();
  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ??
    categoriesQuery.data?.error ??
    workersQuery.data?.error ??
    null;
  const transportError =
    listQuery.error ?? categoriesQuery.error ?? workersQuery.error;
  const services =
    listQuery.data?.pages.flatMap((page) => page.result?.items ?? []) ?? [];
  const categories = categoriesQuery.data?.result ?? [];
  const workers = workersQuery.data?.result ?? [];
  const loading =
    listQuery.isPending || categoriesQuery.isPending || workersQuery.isPending;
  const filtered =
    filters.search.length > 0 ||
    filters.category.length > 0 ||
    filters.status.length > 0;
  const mutationBusy =
    mutations.creating ||
    mutations.updating ||
    mutations.changingStatus ||
    mutations.deleting;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(service: ServiceListItem) {
    setEditing(service);
    setSheetOpen(true);
  }

  async function handleStatusChange(service: ServiceListItem) {
    return mutations.setStatus(
      service.id,
      service.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
    );
  }

  async function retryAll() {
    await Promise.all([
      listQuery.refetch(),
      categoriesQuery.refetch(),
      workersQuery.refetch(),
    ]);
  }

  if (loading) {
    return <ServicesSkeleton />;
  }

  if (transportError || responseError) {
    return (
      <EmptyState
        icon={TriangleAlertIcon}
        title={t("queryErrorTitle")}
        description={
          responseError ? errors(responseError) : t("queryErrorDescription")
        }
        action={
          <Button
            type="button"
            onClick={() => void retryAll()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            beam
            beamActive={!sheetOpen}
            type="button"
            onClick={openCreate}
            disabled={isReadOnly}
            title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
          >
            <PlusIcon aria-hidden="true" />
            {t("newService")}
          </Button>
        }
      />

      <ServiceFilters
        filters={filters}
        categories={categories}
        onChange={setFilters}
      />

      <div
        aria-busy={listQuery.isPlaceholderData}
        className="transition-opacity duration-150 aria-busy:opacity-60 motion-reduce:transition-none"
      >
        <ServicesTable
          services={services}
          filtered={filtered}
          readOnly={isReadOnly}
          hasMore={listQuery.hasNextPage}
          loadingMore={listQuery.isFetchingNextPage}
          mutationBusy={mutationBusy}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onCreate={openCreate}
          onEdit={openEdit}
          onStatusChange={handleStatusChange}
          onDelete={(service) => mutations.remove(service.id)}
        />
      </div>

      <ServiceFormSheet
        open={sheetOpen}
        service={editing}
        categories={categories}
        workers={workers}
        submitting={mutations.creating || mutations.updating}
        onOpenChange={setSheetOpen}
        onCreate={mutations.create}
        onUpdate={mutations.update}
      />
    </div>
  );
}
