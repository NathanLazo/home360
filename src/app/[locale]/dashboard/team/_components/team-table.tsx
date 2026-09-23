"use client";

import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WorkerListItem } from "./team.types";
import { WorkerRowActions } from "./worker-row-actions";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

const INVITATION_VARIANTS: Record<
  WorkerListItem["invitationStatus"],
  StatusBadgeVariant
> = {
  PENDING: "warning",
  ACCEPTED: "success",
};

export function TeamTable({
  workers,
  mutationBusy,
  canCreate,
  onCreate,
  onEdit,
  onResendInvitation,
  onDelete,
}: {
  workers: WorkerListItem[];
  mutationBusy: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onEdit: (worker: WorkerListItem) => void;
  onResendInvitation: (worker: WorkerListItem) => Promise<boolean>;
  onDelete: (worker: WorkerListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.team");
  const columns: Array<DataTableColumn<WorkerListItem>> = [
    {
      key: "worker",
      header: t("columns.worker"),
      className: "min-w-56",
      cell: (worker) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{worker.fullName}</span>
          <span className="text-muted-foreground text-sm">
            {worker.specialty ?? t("noSpecialty")}
          </span>
        </span>
      ),
    },
    {
      key: "services",
      header: t("columns.services"),
      className: "min-w-48 max-w-72",
      cell: (worker) =>
        worker.services.length ? (
          <span className="flex flex-wrap gap-1">
            {worker.services.map((service) => (
              <Badge key={service.id} variant="secondary">
                {service.name}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground italic">
            {t("unassigned")}
          </span>
        ),
    },
    {
      key: "branch",
      header: t("columns.branch"),
      cell: (worker) => (
        <span className="text-muted-foreground">
          {worker.branch?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "invitation",
      header: t("columns.invitation"),
      className: "min-w-48",
      cell: (worker) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge
            status={worker.invitationStatus}
            variantMap={INVITATION_VARIANTS}
            label={t(`invitationStatus.${worker.invitationStatus}`)}
          />
          <span className="text-muted-foreground max-w-full truncate text-sm">
            {worker.invitedEmail ?? t("noEmail")}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (worker) => (
        <WorkerRowActions
          worker={worker}
          busy={mutationBusy}
          onEdit={onEdit}
          onResendInvitation={onResendInvitation}
          onDelete={onDelete}
        />
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={workers}
          emptyState={
            <div className="p-6">
              <EmptyState
                icon={UsersIcon}
                title={t("empty.title")}
                description={t("empty.description")}
                action={
                  <Button
                    type="button"
                    onClick={onCreate}
                    disabled={!canCreate}
                    className="min-h-11"
                  >
                    {t("newWorker")}
                  </Button>
                }
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
