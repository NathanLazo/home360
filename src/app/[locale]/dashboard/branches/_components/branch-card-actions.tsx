"use client";

import { useState } from "react";
import {
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  UserRoundCogIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { BranchListItem } from "./branch.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function BranchCardActions({
  branch,
  statusPending,
  deletePending,
  onEdit,
  onAssignManager,
  onStatus,
  onDelete,
}: {
  branch: BranchListItem;
  statusPending: boolean;
  deletePending: boolean;
  onEdit: () => void;
  onAssignManager: () => void;
  onStatus: (status: "ACTIVE" | "PAUSED") => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.branches");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  // The menu stays reachable so the reason is visible; only the mutating
  // entries are blocked.
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyTitle = isReadOnly ? readOnlyT("actionDisabled") : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextStatus = branch.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.open", { name: branch.name })}
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={onEdit}
            disabled={isReadOnly}
            title={readOnlyTitle}
          >
            <PencilIcon aria-hidden="true" />
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onAssignManager}
            disabled={isReadOnly}
            title={readOnlyTitle}
          >
            <UserRoundCogIcon aria-hidden="true" />
            {t("actions.assignManager")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={statusPending || isReadOnly}
            title={readOnlyTitle}
            onSelect={() => void onStatus(nextStatus)}
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
            disabled={isReadOnly}
            title={readOnlyTitle}
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
        description={t("delete.description", { name: branch.name })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        destructive
        loading={deletePending}
        onConfirm={() =>
          void onDelete().then((ok) => {
            if (ok) setConfirmOpen(false);
          })
        }
      />
    </>
  );
}
