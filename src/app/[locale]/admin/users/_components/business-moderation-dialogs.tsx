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
};

/**
 * One mount point for the four moderation dialogs: the row dropdown and the
 * detail sheet both raise the same `PendingModeration` and never own a dialog.
 */
export function BusinessModerationDialogs({
  pending,
  onClose,
  mutations,
}: BusinessModerationDialogsProps) {
  const t = useTranslations("admin.users.moderation");
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
        loading={mutations.reject.pending}
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
        loading={mutations.suspend.pending}
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
    </>
  );
}
