"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, WalletIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { parsePesosToCents } from "./payment-amount";
import { usePaymentMutations } from "./use-payment-mutations";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const BANK_MIN_LENGTH = 2;
const BANK_MAX_LENGTH = 60;
const ACCOUNT_LAST4_LENGTH = 4;

const withdrawFormSchema = z.object({
  amount: z.string().refine((value) => parsePesosToCents(value) !== null),
  bankName: z.string().trim().min(BANK_MIN_LENGTH).max(BANK_MAX_LENGTH),
  accountLast4: z.string().regex(/^\d{4}$/),
});

type WithdrawFormValues = z.infer<typeof withdrawFormSchema>;

const EMPTY_VALUES: WithdrawFormValues = {
  amount: "",
  bankName: "",
  accountLast4: "",
};

function centsToPesos(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Withdrawal request in two beats: how much (with the available balance
 * right there and a one-tap "all of it"), then where it goes. The ledger
 * figure is the server's; the form only formats and gates it.
 */
export function WithdrawDialog({
  open,
  availableCents,
  onOpenChange,
}: {
  open: boolean;
  availableCents: number;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.payments.withdraw");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const formatter = useFormatter();
  const { requestWithdrawal, requestingWithdrawal } = usePaymentMutations();
  const [confirming, setConfirming] = useState(false);
  const shakeInvalid = useErrorShake();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      return;
    }

    form.reset(EMPTY_VALUES);
    setConfirming(false);
  }, [form, open]);

  // Formatting only: `availableCents` is the server's figure from XC-03 and is
  // never recomputed here.
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const values = form.watch();
  const requestedCents = parsePesosToCents(values.amount);
  const exceedsAvailable =
    requestedCents !== null && requestedCents > availableCents;
  const isMax = requestedCents !== null && requestedCents === availableCents;

  const openConfirmation = form.handleSubmit(
    (submitted) => {
      const cents = parsePesosToCents(submitted.amount);

      if (cents === null) {
        form.setError("amount", { message: t("amountInvalid") });
        shakeInvalid(formRef.current);
        return;
      }

      // Client-side gate is UX only; F3-07 revalidates inside a serializable
      // transaction, so INSUFFICIENT_BALANCE can still come back from the server.
      if (cents > availableCents) {
        form.setError("amount", { message: t("amountExceedsAvailable") });
        shakeInvalid(formRef.current);
        return;
      }

      setConfirming(true);
    },
    () => shakeInvalid(formRef.current),
  );

  async function handleConfirm() {
    const cents = parsePesosToCents(form.getValues("amount"));

    if (cents === null) {
      setConfirming(false);
      return;
    }

    const requested = await requestWithdrawal({
      amountCents: cents,
      bankName: form.getValues("bankName").trim(),
      accountLast4: form.getValues("accountLast4"),
    });

    setConfirming(false);

    if (requested) {
      onOpenChange(false);
    }
  }

  function fillMax() {
    form.setValue("amount", centsToPesos(availableCents), {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.clearErrors("amount");
    form.setFocus("bankName");
  }

  const amountError = form.formState.errors.amount;
  const bankError = form.formState.errors.bankName;
  const last4Error = form.formState.errors.accountLast4;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!requestingWithdrawal) {
            onOpenChange(next);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description", { amount: currency(availableCents) })}
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            onSubmit={openConfirmation}
            className="flex flex-col gap-5"
            noValidate
          >
            <div className="bg-canvas-soft flex items-center justify-between gap-3 rounded-xl border p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-card shadow-hairline flex size-9 shrink-0 items-center justify-center rounded-full">
                  <WalletIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-4"
                  />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
                    {t("availableLabel")}
                  </span>
                  <span className="font-mono text-lg leading-tight font-semibold tabular-nums">
                    {currency(availableCents)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={requestingWithdrawal || isMax}
                onClick={fillMax}
              >
                {t("withdrawAll")}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="withdraw-amount">{t("amountLabel")}</Label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                >
                  $
                </span>
                <Input
                  id="withdraw-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  disabled={requestingWithdrawal}
                  className="pl-7 font-mono tabular-nums"
                  aria-invalid={
                    (amountError ?? exceedsAvailable) ? true : undefined
                  }
                  aria-describedby={
                    amountError || exceedsAvailable
                      ? "withdraw-amount-error"
                      : "withdraw-amount-hint"
                  }
                  {...form.register("amount")}
                />
              </div>
              {amountError || exceedsAvailable ? (
                <p
                  id="withdraw-amount-error"
                  role="alert"
                  className="text-error-deep text-copy-sm"
                >
                  {amountError?.message ??
                    (exceedsAvailable
                      ? t("amountExceedsAvailable")
                      : t("amountInvalid"))}
                </p>
              ) : (
                <p
                  id="withdraw-amount-hint"
                  className="text-muted-foreground text-copy-sm"
                >
                  {t("amountHint", { amount: currency(availableCents) })}
                </p>
              )}
            </div>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-muted-foreground text-label mb-3 font-mono font-medium tracking-wide uppercase">
                {t("destinationTitle")}
              </legend>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="withdraw-bank">{t("bankLabel")}</Label>
                  <Input
                    id="withdraw-bank"
                    autoComplete="off"
                    disabled={requestingWithdrawal}
                    aria-invalid={bankError ? true : undefined}
                    aria-describedby={
                      bankError ? "withdraw-bank-error" : undefined
                    }
                    {...form.register("bankName")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="withdraw-last4" className="text-pretty">
                    {t("last4Label")}
                  </Label>
                  <Input
                    id="withdraw-last4"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={ACCOUNT_LAST4_LENGTH}
                    pattern="\d{4}"
                    placeholder="1234"
                    disabled={requestingWithdrawal}
                    className="font-mono tabular-nums"
                    aria-invalid={last4Error ? true : undefined}
                    aria-describedby={
                      last4Error ? "withdraw-last4-error" : undefined
                    }
                    {...form.register("accountLast4")}
                  />
                </div>
              </div>
              {bankError ? (
                <p
                  id="withdraw-bank-error"
                  role="alert"
                  className="text-error-deep text-copy-sm"
                >
                  {t("bankInvalid")}
                </p>
              ) : null}
              {last4Error ? (
                <p
                  id="withdraw-last4-error"
                  role="alert"
                  className="text-error-deep text-copy-sm"
                >
                  {t("last4Invalid")}
                </p>
              ) : null}
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={requestingWithdrawal}
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                metal="live"
                disabled={requestingWithdrawal || exceedsAvailable}
              >
                {requestingWithdrawal ? (
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

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!requestingWithdrawal) {
            setConfirming(next);
          }
        }}
        title={t("confirmTitle")}
        description={t("confirmDescription", {
          amount: currency(requestedCents ?? 0),
          bank: values.bankName.trim(),
          last4: values.accountLast4,
        })}
        confirmLabel={t("confirmSubmit")}
        cancelLabel={t("cancel")}
        loading={requestingWithdrawal}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
