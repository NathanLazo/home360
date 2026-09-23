"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { ConfirmButtonContent } from "../../_components/confirm-button-content";
import {
  MIN_JUSTIFICATION_LENGTH,
  type ResolveDisputeInput,
} from "./disputes.schema";
import type { DisputeDetail } from "./disputes.types";
import { DisputeResolution } from "@generated/prisma";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

/** Pesos typed by the admin → cents sent to the server, which revalidates. */
function toCents(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export type ResolveDisputeDialogProps = {
  dispute: DisputeDetail;
  resolution: DisputeResolution | null;
  loading: boolean;
  /** The server confirmed; the dialog holds briefly on the check. */
  succeeded?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ResolveDisputeInput) => void;
};

export function ResolveDisputeDialog({
  dispute,
  resolution,
  loading,
  succeeded = false,
  onOpenChange,
  onConfirm,
}: ResolveDisputeDialogProps) {
  const t = useTranslations("admin.disputes.resolveDialog");
  const doneT = useTranslations("admin.feedback.done");
  const busy = loading || succeeded;
  const resolutionsT = useTranslations("admin.disputes.resolutions");
  const formatter = useFormatter();
  const [providerRefund, setProviderRefund] = useState("");
  const [serviceFeeRefund, setServiceFeeRefund] = useState("");
  const [justification, setJustification] = useState("");
  const fieldId = useId();

  useEffect(() => {
    if (resolution === null) {
      setProviderRefund("");
      setServiceFeeRefund("");
      setJustification("");
    }
  }, [resolution]);

  const payment = dispute.payment;
  const recordingMissing =
    dispute.recordingUrl === null || !dispute.recordingComplete;
  const needsJustification =
    recordingMissing && resolution !== DisputeResolution.FULL_REFUND;
  const isPartial = resolution === DisputeResolution.PARTIAL_REFUND;

  const providerCents = toCents(providerRefund);
  const serviceFeeCents = toCents(serviceFeeRefund);
  const partialValid =
    providerCents !== null &&
    serviceFeeCents !== null &&
    providerCents + serviceFeeCents > 0 &&
    payment !== null &&
    providerCents <=
      payment.providerAmountCents - payment.providerRefundedCents &&
    serviceFeeCents <=
      payment.serviceFeeCentsApplied - payment.serviceFeeRefundedCents;

  const justificationValid =
    !needsJustification ||
    justification.trim().length >= MIN_JUSTIFICATION_LENGTH;

  const canConfirm =
    resolution !== null && justificationValid && (!isPartial || partialValid);

  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Display only. The authoritative allocation, commission and limits live in
  // the F3 refund service; the UI never replicates that policy.
  const summary = (() => {
    if (!payment || resolution === null) {
      return null;
    }

    if (resolution === DisputeResolution.FULL_REFUND) {
      return t("summary.full", { amount: currency(payment.amountCents) });
    }

    if (resolution === DisputeResolution.RELEASE_PAYMENT) {
      return t("summary.release", {
        amount: currency(payment.amountCents),
        commission: currency(payment.commissionCents),
      });
    }

    if (isPartial && providerCents !== null && serviceFeeCents !== null) {
      return t("summary.partial", {
        refund: currency(providerCents + serviceFeeCents),
        remainder: currency(
          Math.max(payment.amountCents - providerCents - serviceFeeCents, 0),
        ),
      });
    }

    return null;
  })();

  return (
    <AlertDialog
      open={resolution !== null}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {resolution === null ? t("title") : resolutionsT(resolution)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { dispute: dispute.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          {isPartial && payment ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-provider`}>
                  {t("providerRefund")}
                </Label>
                <Input
                  id={`${fieldId}-provider`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={providerRefund}
                  onChange={(event) => setProviderRefund(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {t("providerAvailable", {
                    amount: currency(
                      payment.providerAmountCents -
                        payment.providerRefundedCents,
                    ),
                  })}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-fee`}>
                  {t("serviceFeeRefund")}
                </Label>
                <Input
                  id={`${fieldId}-fee`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={serviceFeeRefund}
                  onChange={(event) => setServiceFeeRefund(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {t("serviceFeeAvailable", {
                    amount: currency(
                      payment.serviceFeeCentsApplied -
                        payment.serviceFeeRefundedCents,
                    ),
                  })}
                </p>
              </div>
            </>
          ) : null}

          {needsJustification ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-justification`}>
                {t("justification")}
              </Label>
              <Textarea
                id={`${fieldId}-justification`}
                rows={4}
                value={justification}
                placeholder={t("justificationPlaceholder")}
                onChange={(event) => setJustification(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                {t("justificationHint", { min: MIN_JUSTIFICATION_LENGTH })}
              </p>
            </div>
          ) : null}

          {summary ? (
            <p className="bg-muted rounded-lg p-3 text-sm">{summary}</p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !canConfirm}
            aria-disabled={succeeded || undefined}
            onClick={(event) => {
              event.preventDefault();

              if (succeeded || resolution === null || !canConfirm) {
                return;
              }

              onConfirm({
                disputeId: dispute.id,
                resolution,
                ...(isPartial &&
                providerCents !== null &&
                serviceFeeCents !== null
                  ? {
                      providerRefundCents: providerCents,
                      serviceFeeRefundCents: serviceFeeCents,
                    }
                  : {}),
                ...(needsJustification
                  ? { justification: justification.trim() }
                  : {}),
              });
            }}
          >
            <ConfirmButtonContent
              loading={loading}
              succeeded={succeeded}
              label={t("confirm")}
              successLabel={doneT("resolved")}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
