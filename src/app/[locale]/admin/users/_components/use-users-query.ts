"use client";

import { useCallback, useState } from "react";

import type { BusinessDerivedStatus, UsersTab } from "./users.schema";
import type {
  BusinessRow,
  CustomerRow,
  ListUsersResult,
  UserCounts,
  WorkerRow,
} from "./users.types";
import type { ErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type UsersPageItems =
  | { tab: "businesses"; items: BusinessRow[] }
  | { tab: "customers"; items: CustomerRow[] }
  | { tab: "workers"; items: WorkerRow[] };

export type UsersQueryState =
  | { status: "pending" }
  | { status: "error"; code: ErrorCode }
  | { status: "success"; counts: UserCounts; page: UsersPageItems };

export type UsersQuery = {
  state: UsersQueryState;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  refetch: () => void;
};

/**
 * Every page of one fetch shares the requested tab, so the discriminant is
 * resolved once and each page is narrowed by it — never cast.
 */
function flattenPages(results: ListUsersResult[]): UsersPageItems | null {
  const first = results[0];

  if (!first) {
    return null;
  }

  if (first.tab === "businesses") {
    return {
      tab: "businesses",
      items: results.flatMap((page) =>
        page.tab === "businesses" ? page.items : [],
      ),
    };
  }

  if (first.tab === "customers") {
    return {
      tab: "customers",
      items: results.flatMap((page) =>
        page.tab === "customers" ? page.items : [],
      ),
    };
  }

  return {
    tab: "workers",
    items: results.flatMap((page) => (page.tab === "workers" ? page.items : [])),
  };
}

export function useUsersQuery(input: {
  tab: UsersTab;
  search: string;
  status: BusinessDerivedStatus | undefined;
}): UsersQuery {
  const query = api.admin.users.list.useInfiniteQuery(
    {
      tab: input.tab,
      ...(input.search.length > 0 ? { search: input.search } : {}),
      ...(input.tab === "businesses" && input.status
        ? { status: input.status }
        : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const state = ((): UsersQueryState => {
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
    const page = flattenPages(results);

    if (!counts || !page) {
      return { status: "error", code: "UNKNOWN_ERROR" };
    }

    return { status: "success", counts, page };
  })();

  return {
    state,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}

export type CsvExporter = {
  exportCsv: () => void;
  exporting: boolean;
  truncated: boolean;
  errorCode: ErrorCode | null;
};

/**
 * The CSV is generated server-side and downloaded from memory: the object URL
 * is always revoked so the blob is not retained after the click.
 */
export function useCsvExport(tab: UsersTab): CsvExporter {
  const [truncated, setTruncated] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [exporting, setExporting] = useState(false);
  const utils = api.useUtils();

  const exportCsv = useCallback(() => {
    setExporting(true);
    setErrorCode(null);
    setTruncated(false);

    void utils.admin.users.exportCsv
      .fetch({ tab })
      .then((response) => {
        if (response.error !== null || response.result === null) {
          setErrorCode(response.error ?? "UNKNOWN_ERROR");
          return;
        }

        const { csv, filename, truncated: wasTruncated } = response.result;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        setTruncated(wasTruncated);
      })
      .catch((error: unknown) => setErrorCode(toErrorCode(error)))
      .finally(() => setExporting(false));
  }, [tab, utils]);

  return { exportCsv, exporting, truncated, errorCode };
}
