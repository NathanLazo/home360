"use client";

import { useTranslations } from "next-intl";

import { AiConfigCard } from "./ai-config-card";
import { KpiRow } from "./kpi-row";
import { OpenDisputesList } from "./open-disputes-list";
import { PendingBusinessesTable } from "./pending-businesses-table";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

function GridSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-36 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ListSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {kpis.status === "pending" ? (
        <GridSkeleton count={4} label={t("kpis.loading")} />
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
        <section className="flex flex-col gap-3" aria-label={t("pending.title")}>
          <h2 className="text-lg font-semibold">{t("pending.title")}</h2>
          {pending.status === "pending" ? (
            <ListSkeleton count={3} label={t("pending.loading")} />
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

        <section className="flex flex-col gap-3" aria-label={t("ai.title")}>
          <h2 className="text-lg font-semibold">{t("ai.sectionTitle")}</h2>
          {ai.status === "pending" ? (
            <Skeleton className="h-72 w-full rounded-xl" />
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

      <section className="flex flex-col gap-3" aria-label={t("disputes.title")}>
        <h2 className="text-lg font-semibold">{t("disputes.title")}</h2>
        {disputes.status === "pending" ? (
          <ListSkeleton count={3} label={t("disputes.loading")} />
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
