"use client";

import { FlagIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ReportCard } from "./report-card";
import { ReportListSkeleton } from "./report-list-skeleton";
import {
  REPORT_STATUS_FILTERS,
  listReportsSchema,
  type ReportStatusFilter,
} from "./reports.schema";
import { useReportMutations } from "./use-report-mutations";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

/**
 * W14 report queue (App Store 1.2 SLA: reviewed within 24 h). Open reports
 * oldest first; hiding a message removes it from the chat for everyone.
 * Suspensions go through the users and businesses tabs.
 */
export function ReportsView() {
  const t = useTranslations("admin.reports");
  const [status, setStatus] = useState<ReportStatusFilter>("open");
  // Frozen on mount so every relative date shares one reference instant.
  const [now] = useState(() => new Date());
  const mutations = useReportMutations();

  const query = api.admin.reports.list.useInfiniteQuery(
    { status },
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages ?? [];
  const failedCode = pages.find((page) => page.error !== null)?.error;
  const items = pages.flatMap((page) => page.result?.items ?? []);
  const errorCode =
    failedCode ?? (query.error ? toErrorCode(query.error) : null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Select
        value={status}
        onValueChange={(value) =>
          setStatus(listReportsSchema.shape.status.parse(value))
        }
      >
        <SelectTrigger className="w-44" aria-label={t("statusLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_STATUS_FILTERS.map((filter) => (
            <SelectItem key={filter} value={filter}>
              {t(`filters.${filter}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <section
        aria-label={t("listLabel")}
        aria-busy={query.isFetching || undefined}
      >
        {query.isPending ? <ReportListSkeleton label={t("loading")} /> : null}

        {!query.isPending && errorCode !== null ? (
          <SectionError
            title={t("errorTitle")}
            code={errorCode}
            onRetry={() => void query.refetch()}
          />
        ) : null}

        {!query.isPending && errorCode === null && items.length === 0 ? (
          <EmptyState
            icon={FlagIcon}
            title={t(`empty.${status}.title`)}
            description={t(`empty.${status}.description`)}
            action={
              status === "open" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatus("resolved")}
                >
                  {t("empty.open.cta")}
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {!query.isPending && errorCode === null && items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {items.map((report) => (
                <li key={report.id}>
                  <ReportCard
                    report={report}
                    now={now}
                    pending={mutations.pendingId === report.id}
                    onResolve={(action) => mutations.resolve(report.id, action)}
                  />
                </li>
              ))}
            </ul>
            {query.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
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
    </div>
  );
}
