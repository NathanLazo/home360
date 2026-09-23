"use client";

import { useTranslations } from "next-intl";

import { ApproveBusinessDialog } from "./approve-business-dialog";
import { BusinessReasonDialog } from "./business-reason-dialog";
import type { UserMutations } from "./use-user-mutations";
import type { BusinessRowAction } from "./user-row-actions";
import { ConfirmDialog } from "~/components/confirm-dialog";

export type PendingModeration = {
  businessId: string;
  action: BusinessRowAction;
};

export type BusinessModerationDialogsProps = {
  pending: PendingModeration | null;
  onClose: () => void;
  mutations: UserMutations;
  /** Success beat in progress: the open dialog shows its check. */
  succeeded: boolean;
};

/**
 * One mount point for the five moderation dialogs: the row dropdown and the
 * detail sheet both raise the same `PendingModeration` and never own a dialog.
 */
export function BusinessModerationDialogs({
  pending,
  onClose,
  mutations,
  succeeded,
}: BusinessModerationDialogsProps) {
  const t = useTranslations("admin.users.moderation");
  const doneT = useTranslations("admin.feedback.done");
  const businessId = pending?.businessId ?? null;

  return (
    <>
      <ApproveBusinessDialog
        businessId={pending?.action === "approve" ? businessId : null}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        loading={mutations.approve.pending}
        succeeded={succeeded}
        onConfirm={mutations.approve.run}
      />

      <BusinessReasonDialog
        open={pending?.action === "reject"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        title={t("reject.title")}
        description={t("reject.description")}
        confirmLabel={t("reject.confirm")}
        successLabel={doneT("rejected")}
        loading={mutations.reject.pending}
        succeeded={succeeded}
        onConfirm={(reason) => {
          if (businessId) {
            mutations.reject.run({ businessId, reason });
          }
        }}
      />

      <BusinessReasonDialog
        open={pending?.action === "suspend"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        title={t("suspend.title")}
        description={t("suspend.description")}
        confirmLabel={t("suspend.confirm")}
        successLabel={doneT("suspended")}
        loading={mutations.suspend.pending}
        succeeded={succeeded}
        onConfirm={(reason) => {
          if (businessId) {
            mutations.suspend.run({ businessId, reason });
          }
        }}
      />

      <ConfirmDialog
        open={pending?.action === "reactivate"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        title={t("reactivate.title")}
        description={t("reactivate.description")}
        confirmLabel={t("reactivate.confirm")}
        cancelLabel={t("cancel")}
        loading={mutations.reactivate.pending}
        onConfirm={() => {
          if (businessId) {
            mutations.reactivate.run({ businessId });
          }
        }}
      />

      <ConfirmDialog
        open={pending?.action === "reopen"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        title={t("reopen.title")}
        description={t("reopen.description")}
        confirmLabel={t("reopen.confirm")}
        cancelLabel={t("cancel")}
        loading={mutations.reopen.pending}
        onConfirm={() => {
          if (businessId) {
            mutations.reopen.run({ businessId });
          }
        }}
      />
    </>
  );
}
