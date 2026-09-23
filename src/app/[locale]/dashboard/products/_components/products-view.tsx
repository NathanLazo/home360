"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  FileUpIcon,
  PlusIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ProductFilters } from "./product-filters";
import { ProductFormSheet } from "./product-form-sheet";
import { ProductImportDialog } from "./product-import-dialog";
import { ProductStockDialog } from "./product-stock-dialog";
import type { ProductFiltersState, ProductListItem } from "./product.types";
import { ProductsSkeleton } from "./products-skeleton";
import { ProductsTable } from "./products-table";
import { useProductMutations } from "./use-product-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

const INITIAL_FILTERS: ProductFiltersState = {
  search: "",
  category: "",
  status: "",
  lowStockOnly: false,
};

export function ProductsView({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.products");
  const errors = useTranslations("errors");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [adjusting, setAdjusting] = useState<ProductListItem | null>(null);
  const input = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.lowStockOnly ? { lowStockOnly: true } : {}),
    ...(branchId ? { branchId } : {}),
  };
  const listQuery = api.product.list.useInfiniteQuery(input, {
    getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    // Filter/branch changes keep the current rows visible; the full skeleton
    // is only for the first load.
    placeholderData: keepPreviousData,
  });
  const categoriesQuery = api.product.listCategories.useQuery();
  const branchesQuery = api.product.listStockBranches.useQuery();
  const mutations = useProductMutations();
  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ??
    categoriesQuery.data?.error ??
    branchesQuery.data?.error ??
    null;
  const transportError =
    listQuery.error ?? categoriesQuery.error ?? branchesQuery.error;
  const products = pages?.flatMap((page) => page.result?.items ?? []) ?? [];
  const totals = pages?.[0]?.result?.totals ?? { count: 0, lowStockCount: 0 };
  const categories = categoriesQuery.data?.result ?? [];
  const branches = branchesQuery.data?.result ?? [];
  const loading = [
    listQuery.isPending,
    categoriesQuery.isPending,
    branchesQuery.isPending,
  ].some(Boolean);
  const mutationBusy =
    mutations.creating ||
    mutations.updating ||
    mutations.changingStatus ||
    mutations.adjustingStock ||
    mutations.deleting;
  const filtered =
    branchId !== undefined ||
    filters.search.length > 0 ||
    filters.category.length > 0 ||
    filters.status.length > 0 ||
    filters.lowStockOnly;

  async function retryAll() {
    await Promise.all([
      listQuery.refetch(),
      categoriesQuery.refetch(),
      branchesQuery.refetch(),
    ]);
  }

  if (loading) {
    return <ProductsSkeleton />;
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
        subtitle={t("summary", {
          count: totals.count,
          lowStock: totals.lowStockCount,
        })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={isReadOnly}
              title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
            >
              <FileUpIcon aria-hidden="true" />
              {t("import.action")}
            </Button>
            <Button
              metal="live"
              metalActive={!sheetOpen && !importOpen}
              type="button"
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
              disabled={isReadOnly}
              title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
            >
              <PlusIcon aria-hidden="true" />
              {t("newProduct")}
            </Button>
          </div>
        }
      />
      <ProductFilters
        filters={filters}
        categories={categories}
        onChange={setFilters}
      />
      <div
        aria-busy={listQuery.isPlaceholderData}
        className="transition-opacity duration-150 aria-busy:opacity-60 motion-reduce:transition-none"
      >
        <ProductsTable
          products={products}
          branchSelected={Boolean(branchId)}
          filtered={filtered}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          mutationBusy={mutationBusy}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onCreate={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          onEdit={(product) => {
            setEditing(product);
            setSheetOpen(true);
          }}
          onAdjustStock={setAdjusting}
          onStatusChange={async (product) =>
            (
              await mutations.setStatus(
                product.id,
                product.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
              )
            ).ok
          }
          onDelete={async (product) => (await mutations.remove(product.id)).ok}
        />
      </div>
      <ProductStockDialog
        product={adjusting}
        submitting={mutations.adjustingStock}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null);
        }}
        onSubmit={mutations.adjustStock}
      />
      <ProductFormSheet
        open={sheetOpen}
        product={editing}
        branches={branches}
        categories={categories}
        submitting={
          mutations.creating || mutations.updating || mutations.changingStatus
        }
        onOpenChange={setSheetOpen}
        onCreate={mutations.create}
        onUpdate={mutations.update}
      />
      <ProductImportDialog
        open={importOpen}
        initialBranchId={branchId}
        branches={branches}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
