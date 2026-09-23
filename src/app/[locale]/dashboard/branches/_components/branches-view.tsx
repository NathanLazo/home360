"use client";

import { useState } from "react";
import {
  Building2Icon,
  PlusIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { BranchCard } from "./branch-card";
import { BranchesSkeleton } from "./branches-skeleton";
import { BranchFormSheet } from "./branch-form-sheet";
import type { BranchListItem } from "./branch.types";
import { useBranchMutations } from "./use-branch-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { MetalAction } from "~/components/metal";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function BranchesView() {
  const t = useTranslations("dashboard.branches");
  const errors = useTranslations("errors");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const query = api.branch.list.useQuery();
  const mutations = useBranchMutations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BranchListItem | null>(null);

  const data = query.data?.result ?? null;
  const responseError = query.data?.error ?? null;
  const transportError = query.error;

  if (query.isPending) {
    return <BranchesSkeleton />;
  }

  if (transportError || responseError || !data) {
    return (
      <EmptyState
        icon={TriangleAlertIcon}
        title={t("errorTitle")}
        description={
          responseError ? errors(responseError) : t("errorDescription")
        }
        action={
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void query.refetch()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        }
      />
    );
  }

  const atLimit =
    data.limits.max !== null && data.limits.used >= data.limits.max;
  function create() {
    if (atLimit) return;
    setEditing(null);
    setSheetOpen(true);
  }
  function edit(branch: BranchListItem) {
    setEditing(branch);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title={t("title")} subtitle={t("description")} />
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {data.limits.max === null
              ? t("usageUnlimited", { used: data.limits.used })
              : t("usage", { used: data.limits.used, max: data.limits.max })}
          </p>
          <span
            title={
              isReadOnly
                ? readOnlyT("actionDisabled")
                : atLimit
                  ? t("limitTooltip")
                  : undefined
            }
          >
            <MetalAction active={!isReadOnly && !atLimit}>
              <Button
                type="button"
                className="min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-disabled={atLimit}
                aria-describedby={atLimit ? "branch-limit-help" : undefined}
                onClick={create}
                disabled={isReadOnly}
              >
                <PlusIcon aria-hidden="true" />
                {t("new")}
              </Button>
            </MetalAction>
          </span>
          {atLimit ? (
            <span id="branch-limit-help" className="sr-only">
              {t("limitTooltip")}
            </span>
          ) : null}
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={Building2Icon}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button
              type="button"
              className="min-h-11"
              onClick={create}
              disabled={isReadOnly}
              title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
            >
              <PlusIcon aria-hidden="true" />
              {t("emptyAction")}
            </Button>
          }
        />
      ) : (
        <ul
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-label={t("listLabel")}
        >
          {data.items.map((branch) => (
            <li key={branch.id}>
              <BranchCard
                branch={branch}
                statusPending={mutations.statusPending}
                deletePending={mutations.deletePending}
                onEdit={() => edit(branch)}
                onStatus={(status) => mutations.setStatus(branch.id, status)}
                onDelete={() => mutations.remove(branch.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <BranchFormSheet
        open={sheetOpen}
        branch={editing}
        submitting={mutations.submitting}
        onOpenChange={setSheetOpen}
        onCreate={mutations.create}
        onUpdate={mutations.update}
      />
    </div>
  );
}
