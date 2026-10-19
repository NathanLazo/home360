"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { LoaderCircleIcon, PackageCheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DeliveryEvidenceUploader } from "./delivery-evidence-uploader";
import { useDeliveryEvidenceUpload } from "./use-delivery-evidence-upload";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

/** Server bound of `order.markDelivered.note` (D10-2). */
const NOTE_MAX_LENGTH = 500;

/**
 * "Marcar entregado" (DELIVERY): 1–10 photos of the package at the address
 * plus an optional note. Submitting requests the customer's confirmation and
 * arms the auto-release clock, so it stays disabled until at least one photo
 * is stored and nothing is still uploading.
 */
export function OrderMarkDeliveredDialog({
  open,
  folio,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  folio: number;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    evidencePathnames: string[];
    note?: string;
  }) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.orders.actions.deliveredDialog");
  const upload = useDeliveryEvidenceUpload();
  const { reset } = upload;
  const [note, setNote] = useState("");
  const noteId = useId();
  const noteCountId = `${noteId}-count`;
  const submitHintId = useId();
  const canSubmit =
    upload.pathnames.length > 0 && !upload.uploading && !loading;

  useEffect(() => {
    if (!open) {
      reset();
      setNote("");
    }
  }, [open, reset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const trimmed = note.trim();
    const done = await onConfirm({
      evidencePathnames: upload.pathnames,
      ...(trimmed.length > 0 ? { note: trimmed } : {}),
    });
    if (done) onOpenChange(false);
  }

  const submitHint = upload.uploading
    ? t("waitForUploads")
    : upload.pathnames.length === 0
      ? t("needPhoto")
      : upload.hasErrors
        ? t("failedPhotosSkipped")
        : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,48rem)] flex-col overflow-hidden p-0 sm:max-w-xl"
        aria-busy={loading || upload.uploading}
      >
        <DialogHeader className="border-b px-6 py-5 pr-16">
          <DialogTitle>{t("title", { folio })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t("close")}
              disabled={loading}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <DeliveryEvidenceUploader upload={upload} disabled={loading} />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={noteId}>{t("noteLabel")}</Label>
                <span
                  id={noteCountId}
                  className="text-muted-foreground font-mono text-xs tabular-nums"
                >
                  {t("noteCount", {
                    count: note.length,
                    max: NOTE_MAX_LENGTH,
                  })}
                </span>
              </div>
              <Textarea
                id={noteId}
                value={note}
                rows={3}
                maxLength={NOTE_MAX_LENGTH}
                placeholder={t("notePlaceholder")}
                aria-describedby={noteCountId}
                disabled={loading}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col items-stretch gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              id={submitHintId}
              className="text-muted-foreground text-xs sm:max-w-64"
              aria-live="polite"
            >
              {submitHint}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={loading}>
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                metal={canSubmit ? "live" : "static"}
                disabled={!canSubmit}
                aria-describedby={submitHint ? submitHintId : undefined}
                aria-busy={loading || undefined}
              >
                {loading ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <PackageCheckIcon aria-hidden="true" />
                )}
                {t("confirm")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
