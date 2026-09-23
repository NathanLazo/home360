"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocationFormSheet } from "./location-form-sheet";
import { LocationsTable } from "./locations-table";
import { useLocationMutations } from "./use-location-mutations";
import type { CorporateLocationItem } from "../../_components/corporate.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "~/i18n/navigation";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export function LocationsView() {
  const t = useTranslations("corporate.locations");
  const query = api.corporate.listLocations.useQuery({ includeInactive: true });
  const membershipQuery = api.corporate.getMembership.useQuery();
  const mutations = useLocationMutations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateLocationItem | null>(null);
  const [deactivating, setDeactivating] =
    useState<CorporateLocationItem | null>(null);
  const state = unwrapEnvelope(query);

  // The backend rejects mutations of non-ACTIVE accounts either way
  // (`activeCorporateProcedure`); the UI mirrors that so the user is not
  // invited into actions that will fail.
  const accountStatus = membershipQuery.data?.result?.status ?? null;
  const canMutate = accountStatus === "ACTIVE";

  if (state.status === "pending") {
    return (
      <div className="space-y-6" aria-busy="true" role="status">
        <span className="sr-only">{t("loading")}</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-11 w-44 rounded-md" />
          </div>
        </div>
        <Card className="overflow-hidden py-0">
          <CardContent className="px-0">
            <TableSkeleton columns={6} rows={6} />
          </CardContent>
        </Card>
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

  const data = state.data;
  const atLimit =
    data.limits.max !== null && data.limits.used >= data.limits.max;
  const createDisabled = !canMutate || atLimit;

  function create() {
    if (!canMutate || atLimit) return;
    setEditing(null);
    setSheetOpen(true);
  }

  function edit(location: CorporateLocationItem) {
    if (!canMutate) return;
    setEditing(location);
    setSheetOpen(true);
  }

  const createButton = (
    <span
      title={
        !canMutate
          ? t("notActiveTooltip")
          : atLimit && data.limits.max !== null
            ? t("limitTooltip", { max: data.limits.max })
            : undefined
      }
    >
      <Button
        metal={createDisabled ? "static" : "live"}
        metalActive={!sheetOpen}
        type="button"
        className="min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        aria-disabled={createDisabled}
        aria-describedby={atLimit ? "location-limit-help" : undefined}
        onClick={create}
        disabled={!canMutate}
      >
        <PlusIcon aria-hidden="true" />
        {t("new")}
      </Button>
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-muted-foreground text-copy-sm" aria-live="polite">
            {data.limits.max === null
              ? t("usageUnlimited", { used: data.limits.used })
              : t("usage", { used: data.limits.used, max: data.limits.max })}
          </p>
          {createButton}
          {atLimit && data.limits.max !== null ? (
            <p
              id="location-limit-help"
              className="text-muted-foreground text-xs"
            >
              {t("limitTooltip", { max: data.limits.max })}{" "}
              <Link
                href="/corporate/membership"
                className="text-foreground font-medium underline underline-offset-4"
              >
                {t("limitCta")}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <LocationsTable
        locations={data.items}
        canMutate={canMutate}
        deactivating={mutations.deactivating}
        notActiveTooltip={t("notActiveTooltip")}
        emptyAction={
          canMutate && !atLimit ? (
            <Button type="button" className="min-h-11" onClick={create}>
              <PlusIcon aria-hidden="true" />
              {t("emptyAction")}
            </Button>
          ) : undefined
        }
        onEdit={edit}
        onDeactivate={(location) => setDeactivating(location)}
      />

      <LocationFormSheet
        open={sheetOpen}
        location={editing}
        submitting={mutations.submitting}
        onOpenChange={setSheetOpen}
        onCreate={mutations.create}
        onUpdate={mutations.update}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeactivating(null);
        }}
        title={t("deactivateDialog.title")}
        description={t("deactivateDialog.description")}
        confirmLabel={t("deactivateDialog.confirm")}
        cancelLabel={t("deactivateDialog.cancel")}
        destructive
        loading={mutations.deactivating}
        onConfirm={() => {
          if (!deactivating) return;
          void mutations.deactivate(deactivating.id).then((succeeded) => {
            if (succeeded) setDeactivating(null);
          });
        }}
      />
    </div>
  );
}
