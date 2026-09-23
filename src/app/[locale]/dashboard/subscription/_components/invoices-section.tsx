"use client";

import { FileTextIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { InvoiceList } from "./invoice-list";
import { LatestInvoiceSummary } from "./latest-invoice-summary";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

/**
 * Billing history from the local `Invoice` rows, populated by the Stripe
 * invoice webhooks (F4-05). A business approved minutes ago legitimately has
 * none yet, which is an empty state and not an error.
 */
export function InvoicesSection() {
  const t = useTranslations("dashboard.subscription.invoices");
  const errorsT = useTranslations("errors");

  const invoicesQuery = api.subscription.listInvoices.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = invoicesQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const invoicesError =
    responseError ?? (invoicesQuery.error ? "UNKNOWN_ERROR" : null);
  const invoices = (pages ?? []).flatMap((page) =>
    page.error === null ? (page.result?.items ?? []) : [],
  );
  const [latest, ...previous] = invoices;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {invoicesQuery.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" role="status">
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : null}

        {!invoicesQuery.isPending && invoicesError !== null ? (
          <EmptyState
            icon={FileTextIcon}
            title={t("errorTitle")}
            description={errorsT(invoicesError)}
            action={
              <Button
                type="button"
                onClick={() => void invoicesQuery.refetch()}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            }
          />
        ) : null}

        {!invoicesQuery.isPending && invoicesError === null && !latest ? (
          <EmptyState
            icon={FileTextIcon}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : null}

        {latest && invoicesError === null ? (
          <>
            <LatestInvoiceSummary invoice={latest} />
            <InvoiceList invoices={previous} />
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
        ) : null}
      </CardContent>
    </Card>
  );
}
