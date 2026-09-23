"use client";

import { useTranslations } from "next-intl";

import { CorporateInvoicesSection } from "./corporate-invoices-section";
import { LocationUsageCard } from "./location-usage-card";
import { MembershipSummaryCard } from "./membership-summary-card";
import { TierChangeDialog } from "./tier-change-dialog";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export function MembershipView() {
  const t = useTranslations("corporate.membership");
  const query = api.corporate.getMembership.useQuery();
  const state = unwrapEnvelope(query);

  if (state.status === "pending") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" role="status">
        <span className="sr-only">{t("loading")}</span>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-64 rounded-md" />
          <Skeleton className="h-64 rounded-md" />
        </div>
        <Skeleton className="h-72 rounded-md" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <SectionError
        title={t("queryErrorTitle")}
        code={state.code}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const membership = state.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <TierChangeDialog
            membership={membership}
            canMutate={membership.status === "ACTIVE"}
          />
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <MembershipSummaryCard membership={membership} />
        <LocationUsageCard usage={membership.usage} />
      </div>

      <CorporateInvoicesSection />
    </div>
  );
}
