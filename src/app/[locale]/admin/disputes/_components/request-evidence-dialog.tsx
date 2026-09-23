"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import {
  EVIDENCE_NOTE_MAX_LENGTH,
  EVIDENCE_NOTE_MIN_LENGTH,
  type RequestDisputeEvidenceInput,
} from "./disputes.schema";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

/**
 * "Pedir más evidencia" is not a resolution: no money moves. The admin must
 * write what is missing; both parties receive a push and the file moves to
 * "en revisión".
 */
export function RequestEvidenceDialog({
  disputeId,
  disputeTitle,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: {
  disputeId: string;
  disputeTitle: string;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: RequestDisputeEvidenceInput) => void;
}) {
  const t = useTranslations("admin.disputes.evidenceDialog");
  const [note, setNote] = useState("");
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const trimmedLength = note.trim().length;
  const valid =
    trimmedLength >= EVIDENCE_NOTE_MIN_LENGTH &&
    trimmedLength <= EVIDENCE_NOTE_MAX_LENGTH;

  useEffect(() => {
    if (!open) {
      setNote("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { dispute: disputeTitle })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (valid && !loading) {
              onConfirm({ disputeId, note: note.trim() });
            }
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>{t("noteLabel")}</Label>
            <Textarea
              id={fieldId}
              rows={5}
              required
              maxLength={EVIDENCE_NOTE_MAX_LENGTH}
              value={note}
              placeholder={t("notePlaceholder")}
              aria-describedby={hintId}
              onChange={(event) => setNote(event.target.value)}
            />
            <p id={hintId} className="text-muted-foreground text-xs">
              {t("noteHint", { min: EVIDENCE_NOTE_MIN_LENGTH })}
            </p>
          </div>

          <p className="bg-canvas-soft text-copy-sm rounded-md border p-3">
            {t("notice")}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || !valid}
              aria-busy={loading || undefined}
            >
              {loading ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
