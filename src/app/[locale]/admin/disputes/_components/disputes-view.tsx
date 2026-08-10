"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { DisputeDetail } from "./dispute-detail";
import { DisputeList } from "./dispute-list";
import { disputeFilterSchema, type DisputeFilter } from "./disputes.schema";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { toErrorCode } from "~/lib/trpc-errors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const DEFAULT_FILTER: DisputeFilter = "open";

export function DisputesView() {
  const t = useTranslations("admin.disputes");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(() => {
    const parsed = disputeFilterSchema.safeParse(searchParams.get("status"));
    return parsed.success ? parsed.data : DEFAULT_FILTER;
  }, [searchParams]);
  const selectedId = searchParams.get("dispute");

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

  const query = api.admin.disputes.list.useInfiniteQuery(
    { status: filter },
    { getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined },
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

      <Tabs
        value={filter}
        onValueChange={(value) =>
          replaceParams((params) => {
            params.set("status", disputeFilterSchema.parse(value));
            params.delete("dispute");
          })
        }
      >
        <TabsList>
          <TabsTrigger value="open">
            {stats
              ? t("tabs.openWithCount", { count: stats.openCount })
              : t("tabs.open")}
          </TabsTrigger>
          <TabsTrigger value="resolved">
            {stats
              ? t("tabs.resolvedWithCount", { count: stats.resolvedThisMonth })
              : t("tabs.resolved")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section
          aria-label={t("listLabel")}
          className={cn(
            "min-w-0",
            // On small screens the file replaces the list instead of stacking.
            selectedId !== null && "hidden xl:block",
          )}
        >
          {query.isPending ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-xl" />
              ))}
            </div>
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
            />
          ) : null}
        </section>

        <section
          aria-label={t("detailLabel")}
          className={cn(
            "min-w-0",
            selectedId === null && "hidden xl:block",
          )}
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
