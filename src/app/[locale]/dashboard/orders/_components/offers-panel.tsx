"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { OffersTable } from "./offers-table";
import {
  quoteStatusFilterSchema,
  type QuoteStatusFilter,
} from "./orders.schema";
import { RequestDetailSheet } from "./request-detail-sheet";
import { useOfferMutations } from "./use-offer-mutations";
import { SectionError } from "~/components/section-error";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

const ALL = "__all__";

/** "Mis ofertas": the business's own quotes with view / edit / withdraw. */
export function OffersPanel({
  selectedRequestId,
  onOpenRequest,
  onCloseRequest,
}: {
  selectedRequestId: string | null;
  onOpenRequest: (requestId: string) => void;
  onCloseRequest: () => void;
}) {
  const t = useTranslations("dashboard.requests.offers");
  const statusT = useTranslations("dashboard.requests.offerStatus");
  const [status, setStatus] = useState<QuoteStatusFilter | undefined>();
  const mutations = useOfferMutations();
  const workersQuery = api.service.listWorkers.useQuery();
  const listQuery = api.quote.listMine.useInfiniteQuery(
    status ? { status } : {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );
  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (listQuery.error ? toErrorCode(listQuery.error) : null);
  const quotes = pages?.flatMap((page) => page.result?.items ?? []) ?? [];

  return (
    <>
      <div className="flex justify-end">
        <Select
          value={status ?? ALL}
          onValueChange={(value) => {
            const parsed = quoteStatusFilterSchema.safeParse(value);
            setStatus(parsed.success ? parsed.data : undefined);
          }}
        >
          <SelectTrigger
            className="min-h-11 w-full sm:min-h-10 sm:w-48"
            aria-label={t("statusLabel")}
          >
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {quoteStatusFilterSchema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {statusT(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listQuery.isPending ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="px-0">
            <TableSkeleton columns={7} rows={6} label={t("loading")} />
          </CardContent>
        </Card>
      ) : null}

      {!listQuery.isPending && errorCode !== null ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={errorCode}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!listQuery.isPending && errorCode === null ? (
        <OffersTable
          quotes={quotes}
          filtered={status !== undefined}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          withdrawing={mutations.withdrawing}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onOpenRequest={onOpenRequest}
          onWithdraw={mutations.withdraw}
        />
      ) : null}

      <RequestDetailSheet
        requestId={selectedRequestId}
        workers={workersQuery.data?.result ?? []}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseRequest();
        }}
      />
    </>
  );
}
