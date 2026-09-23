"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { loyaltyCancelReasonSchema } from "./finance.schema";
import type { LoyaltyBonusRow } from "./finance.types";
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
 * Writing a bonus off is irreversible, so the admin states why; the reason is
 * stored on the bonus (never in the audit trail, which only flags presence).
 */
export function CancelLoyaltyBonusDialog({
  bonus,
  loading,
  onOpenChange,
  onConfirm,
}: {
  bonus: LoyaltyBonusRow | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { bonusId: string; reason: string }) => void;
}) {
  const t = useTranslations("admin.finance.loyalty.cancelDialog");
  const [reason, setReason] = useState("");
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const valid = loyaltyCancelReasonSchema.safeParse(reason).success;

  useEffect(() => {
    if (bonus === null) {
      setReason("");
    }
  }, [bonus]);

  return (
    <AlertDialog open={bonus !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { business: bonus?.business.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>{t("reasonLabel")}</Label>
          <Textarea
            id={fieldId}
            rows={4}
            required
            maxLength={500}
            value={reason}
            placeholder={t("reasonPlaceholder")}
            aria-describedby={hintId}
            onChange={(event) => setReason(event.target.value)}
          />
          <p id={hintId} className="text-muted-foreground text-xs">
            {t("reasonHint")}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {t("dismiss")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading || !valid}
            aria-busy={loading || undefined}
            onClick={(event) => {
              event.preventDefault();

              if (bonus && valid) {
                onConfirm({ bonusId: bonus.id, reason: reason.trim() });
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
