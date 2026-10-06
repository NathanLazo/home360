"use client";

import { useState } from "react";
import { PlusIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TeamSkeleton } from "./team-skeleton";
import { TeamTable } from "./team-table";
import type { WorkerListItem } from "./team.types";
import { useTeamMutations } from "./use-team-mutations";
import { WorkerFormSheet } from "./worker-form-sheet";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function TeamView() {
  const t = useTranslations("dashboard.team");
  const errors = useTranslations("errors");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerListItem | null>(null);
  // Availability is reported by the worker app, so the table polls to keep
  // the live status badge honest while the owner watches it.
  const listQuery = api.team.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  // Branches feed the form selector only: a business without an active plan
  // gets an empty selector instead of blocking the whole screen.
  const branchesQuery = api.branch.list.useQuery();
  const mutations = useTeamMutations();

  const listResponse = listQuery.data;
  const workers = listResponse?.result?.items ?? [];
  const limit = listResponse?.result?.limit ?? null;
  const branches = branchesQuery.data?.result?.items ?? [];
  const mutationBusy =
    mutations.creating ||
    mutations.updating ||
    mutations.deleting ||
    mutations.resending;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(worker: WorkerListItem) {
    setEditing(worker);
    setSheetOpen(true);
  }

  if (listQuery.isPending) {
    return <TeamSkeleton />;
  }

  if (listQuery.error ?? listResponse?.error) {
    const code = listResponse?.error ?? null;
    return (
      <EmptyState
        icon={TriangleAlertIcon}
        title={t("queryErrorTitle")}
        description={code ? errors(code) : t("queryErrorDescription")}
        action={
          <Button
            type="button"
            onClick={() => void listQuery.refetch()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        }
      />
    );
  }

  const canCreate = (limit?.canCreate ?? false) && !isReadOnly;
  const usage =
    limit === null
      ? t("noPlan")
      : limit.max !== null
        ? t("usage", { used: limit.used, max: limit.max })
        : limit.canCreate
          ? t("unlimited", { used: limit.used })
          : t("noPlan");
  const createBlockedReason = isReadOnly
    ? readOnlyT("actionDisabled")
    : limit?.canCreate === false
      ? limit.max === null
        ? t("noPlanHint")
        : t("limitReachedHint")
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              beam
              beamActive={!sheetOpen}
              type="button"
              onClick={openCreate}
              disabled={!canCreate}
              title={createBlockedReason}
              aria-describedby={
                createBlockedReason ? "team-create-hint" : undefined
              }
            >
              <PlusIcon aria-hidden="true" />
              {t("newWorker")}
            </Button>
            {createBlockedReason ? (
              <p
                id="team-create-hint"
                className="text-muted-foreground text-copy-sm max-w-72"
              >
                {createBlockedReason}
              </p>
            ) : null}
          </div>
        }
      />

      <p className="text-muted-foreground text-copy-sm tabular-nums">{usage}</p>

      <TeamTable
        workers={workers}
        mutationBusy={mutationBusy}
        canCreate={canCreate}
        onCreate={openCreate}
        onEdit={openEdit}
        onResendInvitation={(worker) => mutations.resendInvitation(worker.id)}
        onDelete={(worker) => mutations.remove(worker.id)}
      />

      <WorkerFormSheet
        open={sheetOpen}
        worker={editing}
        branches={branches}
        submitting={mutations.creating || mutations.updating}
        onOpenChange={setSheetOpen}
        onCreate={mutations.create}
        onUpdate={mutations.update}
      />
    </div>
  );
}
