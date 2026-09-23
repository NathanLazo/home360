"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { ConfirmButtonContent } from "../../_components/confirm-button-content";
import { moderationReasonSchema } from "./users.schema";
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
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export type BusinessReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Past-tense label shown with the check once the server confirms. */
  successLabel: string;
  loading: boolean;
  succeeded?: boolean;
  onConfirm: (reason: string) => void;
};

/**
 * Reject and suspend share one dialog because they share one contract: a
 * mandatory reason validated client-side with the very schema the server uses.
 */
export function BusinessReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  successLabel,
  loading,
  succeeded = false,
  onConfirm,
}: BusinessReasonDialogProps) {
  const t = useTranslations("admin.users.reasonDialog");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  useEffect(() => {
    if (!open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const parsed = moderationReasonSchema.safeParse(reason);
  const showError = touched && !parsed.success;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>{t("label")}</Label>
          <Textarea
            id={fieldId}
            value={reason}
            rows={4}
            placeholder={t("placeholder")}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {showError ? (
            <p
              id={errorId}
              role="alert"
              className="text-destructive text-copy-sm"
            >
              {t("invalid")}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading || succeeded}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading || !parsed.success}
            aria-disabled={succeeded || undefined}
            onClick={(event) => {
              event.preventDefault();
              setTouched(true);

              if (!succeeded && parsed.success) {
                onConfirm(parsed.data);
              }
            }}
          >
            <ConfirmButtonContent
              loading={loading}
              succeeded={succeeded}
              label={confirmLabel}
              successLabel={successLabel}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
