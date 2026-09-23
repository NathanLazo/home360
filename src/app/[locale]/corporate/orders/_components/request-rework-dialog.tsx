"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { corporateReworkSchema } from "~/server/api/schemas/corporate";

const noteSchema = corporateReworkSchema.shape.note;
const MIN_NOTE = 10;
const MAX_NOTE = 1_000;

export type RequestReworkDialogProps = {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string) => Promise<boolean>;
};

/**
 * Asks the provider to fix delivered work (`corporate.requestRework`). Only
 * offered while the order awaits confirmation with the escrow held; the
 * automatic release pauses until the provider delivers again.
 */
export function RequestReworkDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: RequestReworkDialogProps) {
  const t = useTranslations("corporate.orders.rework");
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setInvalid(false);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = noteSchema.safeParse(note);

    if (!parsed.success) {
      setInvalid(true);
      document.getElementById("rework-note")?.focus();
      return;
    }

    setInvalid(false);

    if (await onSubmit(parsed.data)) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rework-note">{t("note")}</Label>
            <Textarea
              id="rework-note"
              rows={5}
              maxLength={MAX_NOTE}
              value={note}
              disabled={submitting}
              aria-invalid={invalid}
              aria-describedby={invalid ? "rework-note-error" : undefined}
              onChange={(event) => {
                setNote(event.target.value);
                setInvalid(false);
              }}
            />
            {invalid ? (
              <p
                id="rework-note-error"
                role="alert"
                className="text-error-deep text-xs"
              >
                {t("validation.note", { min: MIN_NOTE, max: MAX_NOTE })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
