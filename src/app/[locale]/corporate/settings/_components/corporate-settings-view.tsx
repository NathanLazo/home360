"use client";

import { useTranslations } from "next-intl";

import { CorporateCompanyCard } from "./corporate-company-card";
import { CorporatePasswordForm } from "./corporate-password-form";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

/** `/corporate/settings`: company file (read-only) and owner password. */
export function CorporateSettingsView() {
  const t = useTranslations("corporate.settings");
  const query = api.corporate.getSettings.useQuery();
  const state = unwrapEnvelope(query);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {state.status === "pending" ? (
        <div className="flex flex-col gap-6" role="status" aria-busy="true">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={state.code}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <CorporateCompanyCard settings={state.data} />
          <CorporatePasswordForm hasPassword={state.data.owner.hasPassword} />
        </>
      ) : null}
    </div>
  );
}
