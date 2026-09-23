"use client";

import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CorporateInvoiceList } from "./corporate-invoice-list";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

/**
 * Consolidated membership billing: a single invoice covers the account and
 * all its locations. A recently activated account legitimately has none yet,
 * which is an empty state and not an error.
 */
export function CorporateInvoicesSection() {
  const t = useTranslations("corporate.membership.invoices");

  const invoicesQuery = api.corporate.listInvoices.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = invoicesQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ??
    (invoicesQuery.error ? toErrorCode(invoicesQuery.error) : null);
  const invoices = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-copy-sm">{t("description")}</p>

        {invoicesQuery.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" role="status">
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : null}

        {!invoicesQuery.isPending && errorCode !== null ? (
          <SectionError
            title={t("errorTitle")}
            code={errorCode}
            onRetry={() => void invoicesQuery.refetch()}
          />
        ) : null}

        {!invoicesQuery.isPending && errorCode === null ? (
          invoices.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          ) : (
            <>
              <CorporateInvoiceList invoices={invoices} />
              {invoicesQuery.hasNextPage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => void invoicesQuery.fetchNextPage()}
                  disabled={invoicesQuery.isFetchingNextPage}
                >
                  {t("loadMore")}
                </Button>
              ) : null}
            </>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
