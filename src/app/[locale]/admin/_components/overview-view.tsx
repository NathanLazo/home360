"use client";

import { useTranslations } from "next-intl";

import { AiConfigCard } from "./ai-config-card";
import { AiConfigCardSkeleton } from "./ai-config-card-skeleton";
import { KpiGridSkeleton } from "./kpi-grid-skeleton";
import { KpiRow } from "./kpi-row";
import { OpenDisputesList } from "./open-disputes-list";
import { OpenDisputesSkeleton } from "./open-disputes-skeleton";
import { PendingBusinessesTable } from "./pending-businesses-table";
import { SectionHeading } from "./section-heading";
import { SectionLink } from "./section-link";
import { TableSkeleton, type TableSkeletonColumn } from "./table-skeleton";
import { OverviewPrimaryAction } from "./overview-primary-action";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const PENDING_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-36" },
  { width: "w-20" },
  { width: "w-24" },
  { width: "w-32", align: "end" },
];

export function OverviewView() {
  const t = useTranslations("admin.overview");

  const kpisQuery = api.admin.overview.getKpis.useQuery();
  const pendingQuery = api.admin.overview.getPendingBusinesses.useQuery();
  const disputesQuery = api.admin.overview.getOpenDisputes.useQuery();
  const aiQuery = api.admin.overview.getAiConfigSummary.useQuery();

  const kpis = unwrapEnvelope(kpisQuery);
  const pending = unwrapEnvelope(pendingQuery);
  const disputes = unwrapEnvelope(disputesQuery);
  const ai = unwrapEnvelope(aiQuery);

  const hasPending = pending.status === "success" && pending.data.length > 0;
  const hasDisputes = disputes.status === "success" && disputes.data.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<OverviewPrimaryAction urgent={hasDisputes} />}
      />

      {kpis.status === "pending" ? (
        <KpiGridSkeleton label={t("kpis.loading")} />
      ) : null}
      {kpis.status === "error" ? (
        <SectionError
          title={t("kpis.errorTitle")}
          code={kpis.code}
          onRetry={() => void kpisQuery.refetch()}
        />
      ) : null}
      {kpis.status === "success" ? <KpiRow kpis={kpis.data} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="admin-overview-pending"
        >
          <SectionHeading
            id="admin-overview-pending"
            title={t("pending.title")}
            action={
              hasPending ? (
                <SectionLink href="/admin/users" label={t("pending.viewAll")} />
              ) : null
            }
          />
          {pending.status === "pending" ? (
            <TableSkeleton
              columns={PENDING_SKELETON_COLUMNS}
              rows={3}
              label={t("pending.loading")}
            />
          ) : null}
          {pending.status === "error" ? (
            <SectionError
              title={t("pending.errorTitle")}
              code={pending.code}
              onRetry={() => void pendingQuery.refetch()}
            />
          ) : null}
          {pending.status === "success" ? (
            <PendingBusinessesTable businesses={pending.data} />
          ) : null}
        </section>

        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="admin-overview-ai"
        >
          <SectionHeading id="admin-overview-ai" title={t("ai.sectionTitle")} />
          {ai.status === "pending" ? (
            <AiConfigCardSkeleton label={t("ai.loading")} />
          ) : null}
          {ai.status === "error" ? (
            <SectionError
              title={t("ai.errorTitle")}
              code={ai.code}
              onRetry={() => void aiQuery.refetch()}
            />
          ) : null}
          {ai.status === "success" ? <AiConfigCard config={ai.data} /> : null}
        </section>
      </div>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="admin-overview-disputes"
      >
        <SectionHeading
          id="admin-overview-disputes"
          title={t("disputes.title")}
          action={
            hasDisputes ? (
              <SectionLink
                href="/admin/disputes"
                label={t("disputes.viewAll")}
              />
            ) : null
          }
        />
        {disputes.status === "pending" ? (
          <OpenDisputesSkeleton label={t("disputes.loading")} />
        ) : null}
        {disputes.status === "error" ? (
          <SectionError
            title={t("disputes.errorTitle")}
            code={disputes.code}
            onRetry={() => void disputesQuery.refetch()}
          />
        ) : null}
        {disputes.status === "success" ? (
          <OpenDisputesList disputes={disputes.data} />
        ) : null}
      </section>
    </div>
  );
}
