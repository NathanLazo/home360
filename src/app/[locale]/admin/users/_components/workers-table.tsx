"use client";

import { HardHatIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { WorkerRow } from "./users.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const availabilityVariants: Record<
  WorkerRow["availability"],
  StatusBadgeVariant
> = {
  AVAILABLE: "success",
  ON_SERVICE: "info",
  OFF: "muted",
};

export function WorkersTable({ workers }: { workers: WorkerRow[] }) {
  const t = useTranslations("admin.users");
  const availabilityT = useTranslations("admin.workerAvailability");
  const formatter = useFormatter();
  const [now] = useState(() => new Date());

  const columns: Array<DataTableColumn<WorkerRow>> = [
    {
      key: "name",
      header: t("columns.worker"),
      className: "min-w-48",
      cell: (row) => <span className="font-medium">{row.fullName}</span>,
    },
    {
      key: "business",
      header: t("columns.business"),
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
          {row.businessName}
        </span>
      ),
    },
    {
      key: "branch",
      header: t("columns.branch"),
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
          {row.branchName ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "specialty",
      header: t("columns.specialty"),
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
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
          className="text-muted-foreground text-sm"
          suppressHydrationWarning
        >
          {formatter.relativeTime(row.createdAt, now)}
        </time>
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
          />
        </div>
      }
    />
  );
}
