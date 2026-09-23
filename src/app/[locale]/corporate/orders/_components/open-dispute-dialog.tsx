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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  DISPUTE_REASONS,
  type DisputeReason,
} from "~/schemas/disputes/dispute-reasons";

const MIN_DESCRIPTION = 20;

function isDisputeReason(value: string): value is DisputeReason {
  return DISPUTE_REASONS.some((reason) => reason === value);
}

export type OpenDisputeDialogProps = {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    reason: DisputeReason;
    description: string;
  }) => Promise<boolean>;
};

/**
 * Opens a dispute while the escrow still holds the money: the payment stays
 * frozen until the HOME360 team resolves it.
 */
export function OpenDisputeDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: OpenDisputeDialogProps) {
  const t = useTranslations("corporate.orders.dispute");
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<"reason" | "description" | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setDescription("");
    setError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reason === "") {
      setError("reason");
      return;
    }

    if (description.trim().length < MIN_DESCRIPTION) {
      setError("description");
      document.getElementById("dispute-description")?.focus();
      return;
    }

    setError(null);

    if (await onSubmit({ reason, description: description.trim() })) {
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
            <Label htmlFor="dispute-reason">{t("reason")}</Label>
            <Select
              value={reason}
              onValueChange={(value) => {
                if (isDisputeReason(value)) setReason(value);
                setError(null);
              }}
              disabled={submitting}
            >
              <SelectTrigger
                id="dispute-reason"
                className="min-h-11 w-full"
                aria-invalid={error === "reason"}
              >
                <SelectValue placeholder={t("reasonPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`reasons.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error === "reason" ? (
              <p role="alert" className="text-error-deep text-xs">
                {t("validation.reason")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dispute-description">{t("details")}</Label>
            <Textarea
              id="dispute-description"
              rows={5}
              value={description}
              disabled={submitting}
              aria-invalid={error === "description"}
              aria-describedby={
                error === "description"
                  ? "dispute-description-error"
                  : undefined
              }
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
            />
            {error === "description" ? (
              <p
                id="dispute-description-error"
                role="alert"
                className="text-error-deep text-xs"
              >
                {t("validation.description", { min: MIN_DESCRIPTION })}
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
            <Button type="submit" variant="destructive" disabled={submitting}>
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
