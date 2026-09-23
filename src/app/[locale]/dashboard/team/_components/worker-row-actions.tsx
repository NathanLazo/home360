"use client";

import { useState } from "react";
import { EllipsisIcon, MailIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WorkerListItem } from "./team.types";
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

export function WorkerRowActions({
  worker,
  busy,
  onEdit,
  onResendInvitation,
  onDelete,
}: {
  worker: WorkerListItem;
  busy: boolean;
  onEdit: (worker: WorkerListItem) => void;
  onResendInvitation: (worker: WorkerListItem) => Promise<boolean>;
  onDelete: (worker: WorkerListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.team");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  // The menu stays reachable so the reason is visible; only the mutating
  // entries are blocked.
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyTitle = isReadOnly ? readOnlyT("actionDisabled") : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canResend =
    worker.invitationStatus === "PENDING" && worker.invitedEmail !== null;

  async function handleDelete() {
    if (await onDelete(worker)) setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.open", { name: worker.fullName })}
            disabled={busy}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => onEdit(worker)}
            disabled={isReadOnly}
            title={readOnlyTitle}
          >
            <PencilIcon aria-hidden="true" />
            {t("actions.edit")}
          </DropdownMenuItem>
          {canResend ? (
            <DropdownMenuItem
              onSelect={() => void onResendInvitation(worker)}
              disabled={busy || isReadOnly}
              title={readOnlyTitle}
            >
              <MailIcon aria-hidden="true" />
              {t("actions.resendInvitation")}
            </DropdownMenuItem>
          ) : null}
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
        description={t("delete.description", { name: worker.fullName })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        destructive
        loading={busy}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
