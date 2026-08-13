"use client";

import { useTranslations } from "next-intl";

import type { CorporateActionTarget } from "./corporate.types";
import { ConfirmDialog } from "~/components/confirm-dialog";

export type ReconcileBillingDialogProps = {
  target: CorporateActionTarget | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (input: { accountId: string }) => void;
};

/**
 * Reconciliation repairs the Stripe side of an account (customer,
 * subscription, membership). It is idempotent, so the copy stresses that
 * repeating it never duplicates billing objects.
 */
export function ReconcileBillingDialog({
  target,
  onOpenChange,
  loading,
  onConfirm,
}: ReconcileBillingDialogProps) {
  const t = useTranslations("admin.corporate.reconcileDialog");

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
