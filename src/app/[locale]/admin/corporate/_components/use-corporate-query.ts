"use client";

import {
  CORPORATE_TAB_STATUS,
  type CorporateTab,
  type CorporateTierValue,
} from "./corporate.schema";
import type { CorporateAccountRow, CorporateCounts } from "./corporate.types";
import type { ErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type CorporateQueryState =
  | { status: "pending" }
  | { status: "error"; code: ErrorCode }
  | { status: "success"; counts: CorporateCounts; items: CorporateAccountRow[] };

export type CorporateQuery = {
  state: CorporateQueryState;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  refetch: () => void;
};

/**
 * Server-side pagination and filtering: every tab/tier/search combination is
 * its own cursor query; the client never loads the whole directory to filter.
 */
export function useCorporateQuery(input: {
  tab: CorporateTab;
  tier: CorporateTierValue | undefined;
  search: string;
}): CorporateQuery {
  const query = api.admin.corporate.list.useInfiniteQuery(
    {
      ...(input.tab === "all"
        ? {}
        : { status: CORPORATE_TAB_STATUS[input.tab] }),
      ...(input.tier ? { tier: input.tier } : {}),
      ...(input.search.length > 0 ? { search: input.search } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const state = ((): CorporateQueryState => {
    if (query.isPending) {
      return { status: "pending" };
    }

    if (query.error) {
      return { status: "error", code: toErrorCode(query.error) };
    }

    const pages = query.data?.pages ?? [];
    const failedCode = pages.find((page) => page.error !== null)?.error;

    if (failedCode) {
      return { status: "error", code: failedCode };
    }

    const results = pages.flatMap((page) => (page.result ? [page.result] : []));
    const counts = results.at(-1)?.counts;

    if (!counts) {
      return { status: "error", code: "UNKNOWN_ERROR" };
    }

    return {
      status: "success",
      counts,
      items: results.flatMap((result) => result.items),
    };
  })();

  return {
    state,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}
