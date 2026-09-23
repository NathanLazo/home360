"use client";

import { useTranslations } from "next-intl";

import type { LoyaltyBonusRow } from "./finance.types";
import { Button } from "~/components/ui/button";

export function LoyaltyBonusRowActions({
  bonus,
  onPay,
  onCancel,
}: {
  bonus: LoyaltyBonusRow;
  onPay: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.finance.loyalty.actions");

  // Only a PENDING bonus can still be settled or written off.
  if (bonus.status !== "PENDING") {
    return null;
  }

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" onClick={onPay}>
        {t("pay")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}
