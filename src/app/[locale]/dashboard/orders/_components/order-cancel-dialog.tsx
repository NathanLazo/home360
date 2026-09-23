"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { orderCancelReasonSchema } from "./orders.schema";
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

/**
 * Cancel confirmation with a mandatory reason (validated with the server's
 * bounds). The copy states whether a full refund will be issued.
 */
export function OrderCancelDialog({
  open,
  folio,
  willRefund,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  folio: number;
  willRefund: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("dashboard.orders.actions.cancelDialog");
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

  const parsed = orderCancelReasonSchema.safeParse(reason);
  const showError = touched && !parsed.success;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title", { folio })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(willRefund ? "descriptionRefund" : "description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>{t("reasonLabel")}</Label>
          <Textarea
            id={fieldId}
            value={reason}
            rows={4}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            disabled={loading}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {showError ? (
            <p
              id={errorId}
              role="alert"
              className="text-destructive text-copy-sm"
            >
              {t("reasonInvalid")}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading}
            aria-busy={loading || undefined}
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
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
