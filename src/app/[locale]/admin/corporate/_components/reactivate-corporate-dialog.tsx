"use client";

import { useTranslations } from "next-intl";

import type { CorporateActionTarget } from "./corporate.types";
import { ConfirmDialog } from "~/components/confirm-dialog";

export type ReactivateCorporateDialogProps = {
  target: CorporateActionTarget | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (input: { accountId: string }) => void;
};

/** Reactivation resumes both corporate access and the Stripe collection. */
export function ReactivateCorporateDialog({
  target,
  onOpenChange,
  loading,
  onConfirm,
}: ReactivateCorporateDialogProps) {
  const t = useTranslations("admin.corporate.reactivateDialog");

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: target?.name ?? "" })}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      loading={loading}
      onConfirm={() => {
        if (target) {
          onConfirm({ accountId: target.id });
        }
      }}
    />
  );
}
