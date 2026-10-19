"use client";

import {
  toAdminOrderListInput,
  type AdminOrderStatusValue,
  type AdminOrderTypeValue,
} from "./admin-orders.schema";
import type { AdminOrderRow } from "./admin-orders.types";
import type { TranslatableErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type AdminOrdersQueryState =
  | { status: "pending" }
  | { status: "error"; code: TranslatableErrorCode }
  | { status: "success"; items: AdminOrderRow[] };

/**
 * Cursor pagination of `admin.orders.list` (25 per page). Changing a filter
 * starts a new cursor chain; the previous rows stay on screen, dimmed,
 * until the new page lands.
 */
export function useAdminOrdersQuery(filters: {
  status: AdminOrderStatusValue | undefined;
  type: AdminOrderTypeValue | undefined;
  search: string;
}) {
  const query = api.admin.orders.list.useInfiniteQuery(
    toAdminOrderListInput(filters),
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
      placeholderData: (previous) => previous,
    },
  );

  const state = ((): AdminOrdersQueryState => {
    if (query.isPending) return { status: "pending" };
    if (query.error) return { status: "error", code: toErrorCode(query.error) };

    const pages = query.data?.pages ?? [];
    const failed = pages.find((page) => page.error !== null)?.error;
    if (failed) return { status: "error", code: failed };

    return {
      status: "success",
      items: pages.flatMap((page) => page.result?.items ?? []),
    };
  })();

  return {
    state,
    refreshing: query.isPlaceholderData,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}
