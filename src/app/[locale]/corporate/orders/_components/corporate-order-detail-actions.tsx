"use client";

import {
  BadgeCheckIcon,
  CreditCardIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { CorporateOrderDetail } from "./corporate-requests.types";
import { Button } from "~/components/ui/button";

export type CorporateOrderDetailActionsProps = {
  actions: CorporateOrderDetail["actions"];
  canMutate: boolean;
  busy: boolean;
  onPay: () => void;
  onConfirm: () => void;
  onRework: () => void;
  onDispute: () => void;
  onCancel: () => void;
};

/**
 * Next steps offered by the server-computed guards (`actions`): the UI never
 * re-derives the state machine, it only mirrors what the backend allows.
 */
export function CorporateOrderDetailActions({
  actions,
  canMutate,
  busy,
  onPay,
  onConfirm,
  onRework,
  onDispute,
  onCancel,
}: CorporateOrderDetailActionsProps) {
  const t = useTranslations("corporate.orders.actions");
  const canPay = actions.canPay && canMutate;
  const hasAny =
    canPay ||
    actions.canConfirm ||
    actions.canRequestRework ||
    actions.canOpenDispute ||
    actions.canCancel;

  if (!hasAny) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canPay ? (
        <Button type="button" disabled={busy} onClick={onPay}>
          <CreditCardIcon aria-hidden="true" />
          {t("pay")}
        </Button>
      ) : null}
      {actions.canConfirm ? (
        <Button type="button" disabled={busy} onClick={onConfirm}>
          <BadgeCheckIcon aria-hidden="true" />
          {t("confirm")}
        </Button>
      ) : null}
      {actions.canRequestRework ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onRework}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("rework")}
        </Button>
      ) : null}
      {actions.canOpenDispute ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onDispute}
        >
          <ShieldAlertIcon aria-hidden="true" />
          {t("dispute")}
        </Button>
      ) : null}
      {actions.canCancel ? (
        <Button
          type="button"
          variant="ghost"
          className="text-error-deep hover:text-error-deep"
          disabled={busy}
          onClick={onCancel}
        >
          <XCircleIcon aria-hidden="true" />
          {t("cancel")}
        </Button>
      ) : null}
    </div>
  );
}
