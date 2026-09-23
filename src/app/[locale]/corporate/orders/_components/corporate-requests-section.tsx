"use client";

import { ClipboardListIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CorporateRequestCard } from "./corporate-request-card";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type CorporateRequestsSectionProps = {
  locationId?: string;
  canMutate: boolean;
  accepting: boolean;
  paying: boolean;
  emptyAction: React.ReactNode;
  onAccept: (quoteId: string) => void;
  onPay: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
};

/** Requests raised by the account and the offers each one received. */
export function CorporateRequestsSection({
  locationId,
  canMutate,
  accepting,
  paying,
  emptyAction,
  onAccept,
  onPay,
  onViewOrder,
}: CorporateRequestsSectionProps) {
  const t = useTranslations("corporate.orders.requests");
  const query = api.corporate.listRequests.useInfiniteQuery(
    locationId ? { locationId } : {},
    { getNextPageParam: (page) => page.result?.nextCursor ?? undefined },
  );
  const pages = query.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (query.error ? toErrorCode(query.error) : null);
  const requests =
    pages?.flatMap((page) =>
      page.error === null ? (page.result?.items ?? []) : [],
    ) ?? [];

  return (
    <section
      aria-labelledby="corporate-requests-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id="corporate-requests-title" className="text-display-sm">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-copy-sm">{t("subtitle")}</p>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-busy="true">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : null}

      {!query.isPending && errorCode !== null ? (
        <SectionError
          title={t("errorTitle")}
          code={errorCode}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isPending && errorCode === null && requests.length === 0 ? (
        <div className="bg-card rounded-lg border p-4 sm:p-6">
          <EmptyState
            headingLevel="h3"
            icon={ClipboardListIcon}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={emptyAction}
          />
        </div>
      ) : null}

      {!query.isPending && errorCode === null && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <CorporateRequestCard
              key={request.id}
              request={request}
              canMutate={canMutate}
              accepting={accepting}
              paying={paying}
              onAccept={onAccept}
              onPay={onPay}
              onViewOrder={onViewOrder}
            />
          ))}
          {query.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-center sm:min-h-10"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("loadMore")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
