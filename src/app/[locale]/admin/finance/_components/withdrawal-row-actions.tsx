"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { withdrawalReasonSchema } from "./finance.schema";
import type { WithdrawalRow } from "./finance.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
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
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

type OpenDialog = "approve" | "reject" | null;

export function WithdrawalRowActions({
  withdrawal,
  pending,
  onApprove,
  onReject,
}: {
  withdrawal: WithdrawalRow;
  pending: boolean;
  onApprove: (withdrawalId: string) => void;
  onReject: (input: { withdrawalId: string; reason: string }) => void;
}) {
  const t = useTranslations("admin.finance.actions");
  const formatter = useFormatter();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [reason, setReason] = useState("");
  const fieldId = useId();

  useEffect(() => {
    if (dialog !== "reject") {
      setReason("");
    }
  }, [dialog]);

  // Only a REQUESTED withdrawal of a non-suspended business is actionable.
  if (withdrawal.status !== "REQUESTED" || withdrawal.business.status === "SUSPENDED") {
    return null;
  }

  const amount = formatter.number(withdrawal.amountCents / 100, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const destination = `${withdrawal.bankName} ••••${withdrawal.accountLast4}`;
  const reasonValid = withdrawalReasonSchema.safeParse(reason).success;

  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        size="sm"
        className="min-h-9"
        onClick={() => setDialog("approve")}
      >
        {t("approve")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9"
        onClick={() => setDialog("reject")}
      >
        {t("reject")}
      </Button>

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => setDialog(open ? "approve" : null)}
        title={t("approveTitle")}
        description={t("approveDescription", { amount, destination })}
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={pending}
        onConfirm={() => onApprove(withdrawal.id)}
      />

      <AlertDialog
        open={dialog === "reject"}
        onOpenChange={(open) => setDialog(open ? "reject" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rejectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rejectDescription", { amount, destination })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>{t("reasonLabel")}</Label>
            <Textarea
              id={fieldId}
              rows={4}
              value={reason}
              placeholder={t("reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending || !reasonValid}
              onClick={(event) => {
                event.preventDefault();
                onReject({
                  withdrawalId: withdrawal.id,
                  reason: reason.trim(),
                });
              }}
            >
              {pending ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
