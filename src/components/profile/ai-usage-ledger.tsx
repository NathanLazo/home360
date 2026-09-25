"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AiUsageRow } from "./ai-usage-row";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

const SKELETON_ROWS = [0, 1, 2];

/** Cursor-paginated ledger of assistant turns (25 per page, "load more"). */
export function AiUsageLedger() {
  const t = useTranslations("profile.billing");
  const query = api.aiBilling.listUsage.useInfiniteQuery(
    {},
    {
      initialCursor: null,
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );
  const pages = query.data?.pages ?? [];
  const envelopeError = pages.find((page) => page.error !== null)?.error;
  const rows = pages.flatMap((page) => page.result?.items ?? []);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-copy font-semibold">{t("ledger.title")}</h3>

      {query.isPending ? (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {SKELETON_ROWS.map((row) => (
            <li key={row}>
              <Skeleton className="h-12 w-full" />
            </li>
          ))}
        </ul>
      ) : query.error || envelopeError ? (
        <SectionError
          title={t("ledgerErrorTitle")}
          code={envelopeError ?? toErrorCode(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-xl px-4 py-3">
          {t("ledger.empty")}
        </p>
      ) : (
        <>
          <div className="-mx-1 flex flex-col">
            {/* Visual column heads for the grid rows; each row already reads
                as a sentence on its own, so they are hidden from AT. */}
            <div
              aria-hidden="true"
              className="text-muted-foreground text-label border-hairline hidden grid-cols-[8.5rem_minmax(0,1fr)_auto_5.5rem] gap-x-4 border-b px-1 pb-2 font-mono sm:grid"
            >
              <span>{t("ledger.columns.date")}</span>
              <span>{t("ledger.columns.model")}</span>
              <span className="text-end">{t("ledger.columns.tokens")}</span>
              <span className="text-end">{t("ledger.columns.cost")}</span>
            </div>
            <ul className="divide-hairline divide-y">
              {rows.map((row) => (
                <AiUsageRow key={row.id} row={row} />
              ))}
            </ul>
          </div>
          {query.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {query.isFetchingNextPage
                ? t("ledger.loadingMore")
                : t("ledger.loadMore")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
