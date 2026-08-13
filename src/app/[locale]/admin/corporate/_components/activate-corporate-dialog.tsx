"use client";

import { useTranslations } from "next-intl";

import type { CorporateActionTarget } from "./corporate.types";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { ConfirmDialog } from "~/components/confirm-dialog";

export type ActivateCorporateDialogProps = {
  target: CorporateActionTarget | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (input: { accountId: string }) => void;
};

/**
 * Activation creates the Stripe subscription, so the dialog summarizes the
 * exact commercial terms (tier, monthly fee, commission) before confirming.
 */
export function ActivateCorporateDialog({
  target,
  onOpenChange,
  loading,
  onConfirm,
}: ActivateCorporateDialogProps) {
  const t = useTranslations("admin.corporate.activateDialog");
  const tierT = useTranslations("admin.corporate.tier");
  const currency = useCurrencyFormatter();

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={
        target
          ? t("description", {
              name: target.name,
              tier: tierT(target.tier),
              fee: currency(target.monthlyFeeCents),
              commission: target.commissionPct,
            })
          : ""
      }
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
