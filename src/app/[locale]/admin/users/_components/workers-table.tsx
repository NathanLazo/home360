"use client";

import type { ReactNode } from "react";
import { HardHatIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { UserAccessAction } from "./user-access-dialogs";
import { UserAccessBadge } from "./user-access-badge";
import type { WorkerRow } from "./users.types";
import { WorkerRowActions } from "./worker-row-actions";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { UserAvatar } from "~/components/user-avatar";

const availabilityVariants: Record<
  WorkerRow["availability"],
  StatusBadgeVariant
> = {
  AVAILABLE: "success",
  ON_SERVICE: "info",
  OFF: "muted",
};

export function WorkersTable({
  workers,
  onOpenBusiness,
  onAccessAction,
  emptyAction,
}: {
  workers: WorkerRow[];
  onOpenBusiness: (businessId: string) => void;
  onAccessAction: (userId: string, action: UserAccessAction) => void;
  emptyAction?: ReactNode;
}) {
  const t = useTranslations("admin.users");
  const availabilityT = useTranslations("admin.workerAvailability");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());

  const columns: Array<DataTableColumn<WorkerRow>> = [
    {
      key: "name",
      header: t("columns.worker"),
      className: "min-w-48",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            seed={row.id}
            name={row.fullName}
            state={row.availability === "OFF" ? "sleeping" : "default"}
          />
          <span className="truncate font-medium">{row.fullName}</span>
        </div>
      ),
    },
    {
      key: "business",
      header: t("columns.business"),
      cell: (row) => (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring text-copy-sm rounded-sm text-left underline-offset-4 transition-colors duration-150 ease-out hover:underline focus-visible:ring-2 focus-visible:outline-none"
          aria-label={t("openBusinessOf", { business: row.businessName })}
          onClick={() => onOpenBusiness(row.businessId)}
        >
          {row.businessName}
        </button>
      ),
    },
    {
      key: "branch",
      header: t("columns.branch"),
      cell: (row) => (
        <span className="text-muted-foreground text-copy-sm">
          {row.branchName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "specialty",
      header: t("columns.specialty"),
      cell: (row) => (
        <span className="text-muted-foreground text-copy-sm">
          {row.specialty ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "availability",
      header: t("columns.availability"),
      cell: (row) => (
        <StatusBadge
          status={row.availability}
          variantMap={availabilityVariants}
          label={availabilityT(row.availability)}
        />
      ),
    },
    {
      key: "createdAt",
      header: t("columns.registeredAt"),
      cell: (row) => (
        <time
          dateTime={row.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(row.createdAt, now)}
        </time>
      ),
    },
    {
      key: "access",
      header: t("columns.account"),
      cell: (row) =>
        row.accessStatus ? (
          <UserAccessBadge status={row.accessStatus} />
        ) : (
          <span className="text-muted-foreground text-copy-sm">
            {t("noAppAccount")}
          </span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <WorkerRowActions
          accessStatus={row.accessStatus}
          onViewBusiness={() => onOpenBusiness(row.businessId)}
          onAccessAction={(action) => {
            if (row.userId) {
              onAccessAction(row.userId, action);
            }
          }}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={workers}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={HardHatIcon}
            title={t("empty.workers.title")}
            description={t("empty.workers.description")}
            action={emptyAction}
          />
        </div>
      }
    />
  );
}
