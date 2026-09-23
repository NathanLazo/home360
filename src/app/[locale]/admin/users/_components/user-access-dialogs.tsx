"use client";

import { useTranslations } from "next-intl";

import { BusinessReasonDialog } from "./business-reason-dialog";
import type { UserAccessMutations } from "./use-user-access-mutations";
import { ConfirmDialog } from "~/components/confirm-dialog";

export type UserAccessAction = "suspend" | "reactivate";

export type PendingUserAccess = {
  userId: string;
  action: UserAccessAction;
};

export type UserAccessDialogsProps = {
  pending: PendingUserAccess | null;
  onClose: () => void;
  mutations: UserAccessMutations;
  /** Success beat in progress: the reason dialog shows its check. */
  succeeded: boolean;
};

/**
 * One mount point for account suspension: the customers and workers rows and
 * the customer sheet all raise the same `PendingUserAccess`.
 */
export function UserAccessDialogs({
  pending,
  onClose,
  mutations,
  succeeded,
}: UserAccessDialogsProps) {
  const t = useTranslations("admin.users.access");
  const doneT = useTranslations("admin.feedback.done");
  const userId = pending?.userId ?? null;
  const closeOnDismiss = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <BusinessReasonDialog
        open={pending?.action === "suspend"}
        onOpenChange={closeOnDismiss}
        title={t("suspend.title")}
        description={t("suspend.description")}
        confirmLabel={t("suspend.confirm")}
        successLabel={doneT("suspended")}
        loading={mutations.suspend.pending}
        succeeded={succeeded}
        onConfirm={(reason) => {
          if (userId) {
            mutations.suspend.run({ userId, reason });
          }
        }}
      />

      <ConfirmDialog
        open={pending?.action === "reactivate"}
        onOpenChange={closeOnDismiss}
        title={t("reactivate.title")}
        description={t("reactivate.description")}
        confirmLabel={t("reactivate.confirm")}
        cancelLabel={t("cancel")}
        loading={mutations.reactivate.pending}
        onConfirm={() => {
          if (userId) {
            mutations.reactivate.run({ userId });
          }
        }}
      />
    </>
  );
}
