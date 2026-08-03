"use client";

import { BoxIcon, LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ProductRowActions } from "./product-row-actions";
import { ProductStatusBadge } from "./product-status-badge";
import { ProductStockCell } from "./product-stock-cell";
import type { ProductListItem } from "./product.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function ProductsTable({
  products,
  branchSelected,
  filtered,
  hasMore,
  loadingMore,
  mutationBusy,
  onLoadMore,
  onCreate,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  products: ProductListItem[];
  branchSelected: boolean;
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  mutationBusy: boolean;
  onLoadMore: () => void;
  onCreate: () => void;
  onEdit: (product: ProductListItem) => void;
  onStatusChange: (product: ProductListItem) => Promise<boolean>;
  onDelete: (product: ProductListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.products");
  const formatter = useFormatter();
  const columns: Array<DataTableColumn<ProductListItem>> = [
    {
      key: "name",
      header: t("columns.product"),
      className: "min-w-56",
      cell: (product) => (
        <span className="flex items-center gap-3 font-medium">
          <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
            <BoxIcon aria-hidden="true" className="size-4" />
          </span>
          {product.name}
        </span>
      ),
    },
    {
      key: "sku",
      header: t("columns.sku"),
      cell: (product) => (
        <span className="font-mono text-sm tabular-nums">{product.sku}</span>
      ),
    },
    {
      key: "category",
      header: t("columns.category"),
      cell: (product) => (
        <span className="text-muted-foreground">{product.category}</span>
      ),
    },
    {
      key: "price",
      header: t("columns.price"),
      className: "text-right",
      cell: (product) => (
        <span className="block font-mono font-semibold tabular-nums">
          {formatter.number(product.priceCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "stock",
      header: t(branchSelected ? "columns.branchStock" : "columns.totalStock"),
      className: "min-w-40",
      cell: (product) => (
        <ProductStockCell product={product} branchSelected={branchSelected} />
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (product) => (
        <ProductStatusBadge
          status={product.status}
          label={t(`status.${product.status}`)}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (product) => (
        <ProductRowActions
          product={product}
          busy={mutationBusy}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={products}
          emptyState={
            <div className="p-6">
              <EmptyState
                icon={BoxIcon}
                title={t(filtered ? "empty.filteredTitle" : "empty.title")}
                description={t(
                  filtered ? "empty.filteredDescription" : "empty.description",
                )}
                action={
                  !filtered ? (
                    <Button
                      type="button"
                      onClick={onCreate}
                      className="min-h-11"
                    >
                      {t("newProduct")}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          }
        />
      </CardContent>
      {hasMore ? (
        <div className="flex justify-center border-t p-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
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
  );
}
