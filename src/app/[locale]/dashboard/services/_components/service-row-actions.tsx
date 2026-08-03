"use client";

import { useState } from "react";
import {
  EllipsisIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ServiceListItem } from "./service.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ServiceRowActions({
  service,
  busy,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  service: ServiceListItem;
  busy: boolean;
  onEdit: (service: ServiceListItem) => void;
  onStatusChange: (service: ServiceListItem) => Promise<boolean>;
  onDelete: (service: ServiceListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.services");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextStatus = service.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

  async function handleDelete() {
    if (await onDelete(service)) setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 sm:min-h-10 sm:min-w-10"
            aria-label={t("actions.open", { name: service.name })}
            disabled={busy}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(service)}>
            <PencilIcon aria-hidden="true" />
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void onStatusChange(service)}
            disabled={busy}
          >
            {nextStatus === "ACTIVE" ? (
              <PlayIcon aria-hidden="true" />
            ) : (
              <PauseIcon aria-hidden="true" />
            )}
            {t(nextStatus === "ACTIVE" ? "actions.activate" : "actions.pause")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2Icon aria-hidden="true" />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("delete.title")}
        description={t("delete.description", { name: service.name })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        destructive
        loading={busy}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
