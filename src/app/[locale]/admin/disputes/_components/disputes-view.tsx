"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { DisputeDetail } from "./dispute-detail";
import { DisputeFilters } from "./dispute-filters";
import { DisputeList } from "./dispute-list";
import { DisputeListSkeleton } from "./dispute-list-skeleton";
import {
  disputeFilterSchema,
  disputeUrgencyFilterSchema,
  type DisputeFilter,
} from "./disputes.schema";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { toErrorCode } from "~/lib/trpc-errors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const DEFAULT_FILTER: DisputeFilter = "open";
const SEARCH_DEBOUNCE_MS = 300;

export function DisputesView() {
  const t = useTranslations("admin.disputes");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(() => {
    const parsed = disputeFilterSchema.safeParse(searchParams.get("status"));
    return parsed.success ? parsed.data : DEFAULT_FILTER;
  }, [searchParams]);
  const urgency = useMemo(() => {
    const parsed = disputeUrgencyFilterSchema.safeParse(
      searchParams.get("urgency"),
    );
    return parsed.success ? parsed.data : null;
  }, [searchParams]);
  const selectedId = searchParams.get("dispute");

  // The field stays local so typing never waits on the URL; the query and
  // the URL follow once typing pauses.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if ((searchParams.get("q") ?? "") === debouncedSearch) {
      return;
    }

    replaceParams((params) => {
      if (debouncedSearch.length > 0) {
        params.set("q", debouncedSearch);
      } else {
        params.delete("q");
      }
      params.delete("dispute");
    });
  }, [debouncedSearch, replaceParams, searchParams]);

  const query = api.admin.disputes.list.useInfiniteQuery(
    {
      status: filter,
      ...(urgency ? { urgency } : {}),
      ...(debouncedSearch.length > 0 ? { search: debouncedSearch } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages ?? [];
  const failedCode = pages.find((page) => page.error !== null)?.error;
  const results = pages.flatMap((page) => (page.result ? [page.result] : []));
  const items = results.flatMap((page) => page.items);
  const stats = results.at(-1);

  // Landing without a selection opens the first dispute so the detail pane is
  // never an empty column on desktop.
  const firstId = items[0]?.id;
  useEffect(() => {
    if (selectedId === null && firstId !== undefined) {
      replaceParams((params) => params.set("dispute", firstId));
    }
  }, [selectedId, firstId, replaceParams]);

  const errorCode =
    failedCode ?? (query.error ? toErrorCode(query.error) : null);
  const filtered =
    filter !== DEFAULT_FILTER || urgency !== null || debouncedSearch.length > 0;

  const clearFilters = () => {
    setSearch("");
    replaceParams((params) => {
      params.delete("status");
      params.delete("urgency");
      params.delete("q");
      params.delete("dispute");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={
          stats
            ? t("subtitleWithStats", {
                open: stats.openCount,
                resolved: stats.resolvedThisMonth,
              })
            : t("subtitle")
        }
      />

      <DisputeFilters
        status={filter}
        urgency={urgency}
        search={search}
        onStatusChange={(value) =>
          replaceParams((params) => {
            params.set("status", value);
            params.delete("dispute");
          })
        }
        onUrgencyChange={(value) =>
          replaceParams((params) => {
            if (value === null) {
              params.delete("urgency");
            } else {
              params.set("urgency", value);
            }
            params.delete("dispute");
          })
        }
        onSearchChange={setSearch}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section
          aria-label={t("listLabel")}
          aria-busy={query.isFetching || undefined}
          className={cn(
            "min-w-0",
            // On small screens the file replaces the list instead of stacking.
            selectedId !== null && "hidden xl:block",
          )}
        >
          {query.isPending ? (
            <DisputeListSkeleton label={t("loading")} />
          ) : null}

          {!query.isPending && errorCode !== null ? (
            <SectionError
              title={t("errorTitle")}
              code={errorCode}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {!query.isPending && errorCode === null ? (
            <DisputeList
              disputes={items}
              selectedId={selectedId}
              hasMore={Boolean(query.hasNextPage)}
              loadingMore={query.isFetchingNextPage}
              onLoadMore={() => void query.fetchNextPage()}
              onSelect={(disputeId) =>
                replaceParams((params) => params.set("dispute", disputeId))
              }
              emptyAction={
                filtered ? (
                  <ClearFiltersButton onClear={clearFilters} />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      replaceParams((params) => {
                        params.set("status", "resolved");
                        params.delete("dispute");
                      })
                    }
                  >
                    {t("empty.showResolved")}
                  </Button>
                )
              }
            />
          ) : null}
        </section>

        <section
          aria-label={t("detailLabel")}
          className={cn("min-w-0", selectedId === null && "hidden xl:block")}
        >
          <DisputeDetail
            disputeId={selectedId}
            onBack={() => replaceParams((params) => params.delete("dispute"))}
          />
        </section>
      </div>
    </div>
  );
}
