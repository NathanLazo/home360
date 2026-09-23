"use client";

import { useTranslations } from "next-intl";

import { ConfirmDialog } from "~/components/confirm-dialog";

export type ActiveSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
};

/**
 * Shown when the account is already open on another computer. Confirming
 * signs in here and closes the other session (single active session).
 */
export function ActiveSessionDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: ActiveSessionDialogProps) {
  const t = useTranslations("auth.login.activeSession");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}
