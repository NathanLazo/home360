"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { LoaderCircleIcon, ScanLineIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  isPickupCodeShape,
  normalizePickupCodeInput,
  PICKUP_CODE_LENGTH,
} from "./pickup-code.utils";
import type { TranslatableErrorCode } from "~/server/api/contract";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type RedeemPickupOutcome =
  { ok: true } | { ok: false; code: TranslatableErrorCode };

/** Codes with copy specific to this field; the rest use `errors.*`. */
const FIELD_ERROR_CODES = [
  "PICKUP_CODE_INVALID",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
] as const;

type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

function isFieldErrorCode(code: string): code is FieldErrorCode {
  return FIELD_ERROR_CODES.some((known) => known === code);
}

/**
 * "Canjear recolección" (PICKUP): the counter types or scans (a handheld
 * scanner types like a keyboard) the customer's 10-character code. A valid
 * code records PICKED_UP, confirms and releases the payment in one step.
 */
export function OrderRedeemPickupDialog({
  open,
  loading,
  onOpenChange,
  onRedeem,
}: {
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onRedeem: (code: string) => Promise<RedeemPickupOutcome>;
}) {
  const t = useTranslations("dashboard.orders.actions.redeemDialog");
  const errorsT = useTranslations("errors");
  const [code, setCode] = useState("");
  const [error, setError] = useState<"shape" | TranslatableErrorCode | null>(
    null,
  );
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!isPickupCodeShape(code)) {
      setError("shape");
      return;
    }

    setError(null);
    const outcome = await onRedeem(code);

    if (outcome.ok) {
      onOpenChange(false);
      return;
    }

    setError(outcome.code);
    window.requestAnimationFrame(() =>
      document.getElementById(fieldId)?.focus(),
    );
  }

  const errorText =
    error === null
      ? null
      : error === "shape"
        ? t("errors.shape", { length: PICKUP_CODE_LENGTH })
        : isFieldErrorCode(error)
          ? t(`errors.${error}`)
          : errorsT(error);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b px-6 py-5 pr-16">
            <DialogTitle>{t("title")}</DialogTitle>
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

          <div className="flex flex-col gap-2 px-6 py-5">
            <Label htmlFor={fieldId}>{t("codeLabel")}</Label>
            <Input
              id={fieldId}
              name="pickup-code"
              value={code}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="done"
              placeholder={t("codePlaceholder")}
              disabled={loading}
              aria-invalid={error !== null || undefined}
              aria-describedby={
                error !== null ? `${errorId} ${hintId}` : hintId
              }
              className="font-mono text-base tracking-[0.2em] uppercase tabular-nums"
              onChange={(event) => {
                setCode(normalizePickupCodeInput(event.target.value));
                if (error !== null) setError(null);
              }}
            />
            {errorText ? (
              <p
                id={errorId}
                role="alert"
                className="text-error-deep text-copy-sm"
              >
                {errorText}
              </p>
            ) : null}
            <p id={hintId} className="text-muted-foreground text-xs">
              {t("codeHint", { length: PICKUP_CODE_LENGTH })}
            </p>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              metal="live"
              disabled={loading || code.length === 0}
              aria-busy={loading || undefined}
            >
              {loading ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ScanLineIcon aria-hidden="true" />
              )}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
