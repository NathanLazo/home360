"use client";

import { useTranslations } from "next-intl";

import { CorporateReasonDialog } from "./corporate-reason-dialog";
import type { CorporateActionTarget } from "./corporate.types";

export type SuspendCorporateDialogProps = {
  target: CorporateActionTarget | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (input: { accountId: string; reason: string }) => void;
};

/**
 * Suspension is destructive twice over: it pauses corporate access *and* the
 * Stripe collection. The reason is mandatory and lands in `statusReason`.
 */
export function SuspendCorporateDialog({
  target,
  onOpenChange,
  loading,
  onConfirm,
}: SuspendCorporateDialogProps) {
  const t = useTranslations("admin.corporate.suspendDialog");

  return (
    <CorporateReasonDialog
      open={target !== null}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: target?.name ?? "" })}
      confirmLabel={t("confirm")}
      loading={loading}
      onConfirm={(reason) => {
        if (target) {
          onConfirm({ accountId: target.id, reason });
        }
      }}
    />
  );
}
