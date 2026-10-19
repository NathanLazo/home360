"use client";

import { useEffect, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AdminOrderDetailSheet } from "./admin-order-detail-sheet";
import { AdminOrderFilters } from "./admin-order-filters";
import { AdminOrdersTable } from "./admin-orders-table";
import { ADMIN_ORDERS_SKELETON_COLUMNS } from "./admin-orders-skeleton";
import { ADMIN_ORDER_SEARCH_MAX } from "./admin-orders.schema";
import { useAdminOrdersQuery } from "./use-admin-orders-query";
import { useAdminOrdersUrlState } from "./use-admin-orders-url-state";
import { useDebouncedValue } from "./use-debounced-value";
import { ADMIN_TABLE_CARD_CLASS } from "../../_components/admin-surface";
import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { TableSkeleton } from "../../_components/table-skeleton";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * W-admin orders (D10-14): every order of the platform, any type. A table
 * view: the `h1` is screen-reader only and the toolbar leads the screen.
 */
export function AdminOrdersView() {
  const t = useTranslations("admin.orders");
  const urlState = useAdminOrdersUrlState();
  const [search, setSearch] = useState(urlState.search);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Only the debounced text reaches the URL (no history spam per key).
  useEffect(() => {
    if (debouncedSearch.trim() !== urlState.search) {
      urlState.setSearch(debouncedSearch.trim());
    }
    // urlState changes identity on every params change; the sync only
    // depends on the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const query = useAdminOrdersQuery({
    status: urlState.status,
    type: urlState.type,
    search: urlState.search,
  });
  const filtered =
    urlState.search.length > 0 ||
    urlState.status !== undefined ||
    urlState.type !== undefined;
  const clearFilters = () => {
    setSearch("");
    urlState.clearFilters();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{t("title")}</h1>

      <AdminOrderFilters
        search={search}
        onSearchChange={(value) =>
          setSearch(value.slice(0, ADMIN_ORDER_SEARCH_MAX))
        }
        status={urlState.status}
        onStatusChange={urlState.setStatus}
        type={urlState.type}
        onTypeChange={urlState.setType}
        onClearFilters={urlState.clearSelectFilters}
      />

      {query.state.status === "pending" ? (
        <TableSkeleton
          columns={ADMIN_ORDERS_SKELETON_COLUMNS}
          label={t("loading")}
        />
      ) : null}

      {query.state.status === "error" ? (
        <SectionError
          title={t("errorTitle")}
          code={query.state.code}
          onRetry={query.refetch}
        />
      ) : null}

      {query.state.status === "success" ? (
        <Card
          className={cn(
            ADMIN_TABLE_CARD_CLASS,
            query.refreshing &&
              "pointer-events-none opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
          )}
          aria-busy={query.refreshing || undefined}
        >
          <CardContent className="px-0">
            <AdminOrdersTable
              orders={query.state.items}
              filtered={filtered}
              onOpenOrder={urlState.openOrder}
              emptyAction={
                filtered ? <ClearFiltersButton onClear={clearFilters} /> : null
              }
            />
          </CardContent>
          {query.hasMore ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                disabled={query.loadingMore}
                onClick={query.loadMore}
              >
                {query.loadingMore ? (
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

      <AdminOrderDetailSheet
        orderId={urlState.orderId}
        onClose={urlState.closeOrder}
      />
    </div>
  );
}
