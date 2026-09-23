"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { corporateReasonSchema } from "./corporate.schema";
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

export type CorporateReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
};

/**
 * Suspension and tier-request rejection share one contract: a mandatory
 * reason validated client-side with the very schema the server uses.
 */
export function CorporateReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
}: CorporateReasonDialogProps) {
  const t = useTranslations("admin.corporate.reasonDialog");
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

  const parsed = corporateReasonSchema.safeParse(reason);
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
          <AlertDialogCancel disabled={loading}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading || !parsed.success}
            onClick={(event) => {
              event.preventDefault();
              setTouched(true);

              if (parsed.success) {
                onConfirm(parsed.data);
              }
            }}
          >
            {loading ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
