"use client";

import { useState } from "react";
import { MapPinOffIcon, RadarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import {
  RadarBranchSelect,
  type RadarBranchOption,
} from "./radar-branch-select";
import { RequestDetailSheet } from "./request-detail-sheet";
import { RequestsTable } from "./requests-table";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { TableSkeleton } from "~/components/table-skeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Link } from "~/i18n/navigation";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

function BranchLocationMissing({ title }: { title: string }) {
  const t = useTranslations("dashboard.requests.radar");

  return (
    <EmptyState
      icon={MapPinOffIcon}
      title={title}
      description={t("noLocationDescription")}
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard/branches">{t("goToBranches")}</Link>
        </Button>
      }
    />
  );
}

/**
 * "Solicitudes": OPEN/QUOTED service requests near one of the business's
 * branches (radar). The origin follows the header branch when it can act as
 * one (ACTIVE + coordinates); otherwise the server picks the first eligible
 * branch and the user may switch among the eligible ones.
 */
export function RequestsPanel({
  branchId,
  selectedRequestId,
  onOpenRequest,
  onCloseRequest,
}: {
  branchId?: string;
  selectedRequestId: string | null;
  onOpenRequest: (requestId: string) => void;
  onCloseRequest: () => void;
}) {
  const t = useTranslations("dashboard.requests");
  const formatter = useFormatter();
  const branchesQuery = api.branch.list.useQuery();
  const workersQuery = api.service.listWorkers.useQuery();
  const workers = workersQuery.data?.result ?? [];
  const branchItems = branchesQuery.data?.result?.items ?? [];
  const candidates: RadarBranchOption[] = branchItems
    .filter(
      (branch) =>
        branch.status === "ACTIVE" &&
        branch.latitude !== null &&
        branch.longitude !== null,
    )
    .map((branch) => ({ id: branch.id, name: branch.name }));
  const headerBranch = branchId
    ? branchItems.find((branch) => branch.id === branchId)
    : undefined;
  const headerBranchUsable =
    headerBranch !== undefined &&
    candidates.some((candidate) => candidate.id === headerBranch.id);
  const [pickedBranchId, setPickedBranchId] = useState<string | undefined>();
  const radarBranchId =
    pickedBranchId ?? (headerBranchUsable ? branchId : undefined);
  const headerBranchBlocked =
    headerBranch !== undefined && !headerBranchUsable && !pickedBranchId;

  const listQuery = api.radar.listOpenRequests.useInfiniteQuery(
    radarBranchId ? { branchId: radarBranchId } : {},
    {
      enabled: branchesQuery.isSuccess && !headerBranchBlocked,
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );
  const pages = listQuery.data?.pages;
  const firstPage = pages?.[0]?.result ?? null;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (listQuery.error ? toErrorCode(listQuery.error) : null);
  const requests = pages?.flatMap((page) => page.result?.items ?? []) ?? [];
  const originName =
    candidates.find((candidate) => candidate.id === firstPage?.branchId)
      ?.name ?? null;
  const loading =
    branchesQuery.isPending || (!headerBranchBlocked && listQuery.isPending);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-copy-sm inline-flex items-center gap-2">
          <RadarIcon aria-hidden="true" className="size-4 shrink-0" />
          {firstPage && originName
            ? t("radar.origin", {
                branch: originName,
                km: formatter.number(firstPage.effectiveRadiusKm, {
                  maximumFractionDigits: 1,
                }),
              })
            : t("radar.intro")}
        </p>
        <RadarBranchSelect
          branches={candidates}
          value={radarBranchId ?? firstPage?.branchId}
          onChange={setPickedBranchId}
        />
      </div>

      {loading ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="px-0">
            <TableSkeleton columns={7} rows={6} label={t("loading")} />
          </CardContent>
        </Card>
      ) : null}

      {!loading && headerBranchBlocked ? (
        <BranchLocationMissing
          title={t("radar.branchNoLocationTitle", {
            branch: headerBranch.name,
          })}
        />
      ) : null}

      {!loading && !headerBranchBlocked && errorCode === "NOT_FOUND" ? (
        <BranchLocationMissing title={t("radar.noLocationTitle")} />
      ) : null}

      {!loading &&
      !headerBranchBlocked &&
      errorCode !== null &&
      errorCode !== "NOT_FOUND" ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={errorCode}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!loading && !headerBranchBlocked && errorCode === null ? (
        <RequestsTable
          requests={requests}
          hasMore={Boolean(listQuery.hasNextPage)}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onSelect={(request) => onOpenRequest(request.id)}
        />
      ) : null}

      <RequestDetailSheet
        requestId={selectedRequestId}
        branchId={radarBranchId ?? firstPage?.branchId}
        workers={workers}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseRequest();
        }}
      />
    </>
  );
}
