"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
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
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="withdraw-amount">{t("amountLabel")}</Label>
              <Input
                id="withdraw-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                disabled={requestingWithdrawal}
                className="font-mono tabular-nums"
                aria-invalid={
                  (amountError ?? exceedsAvailable) ? true : undefined
                }
                aria-describedby="withdraw-amount-hint"
                {...form.register("amount")}
              />
              <p
                id="withdraw-amount-hint"
                className="text-muted-foreground text-copy-sm"
              >
                {t("amountHint", { amount: currency(availableCents) })}
              </p>
              {amountError ? (
                <p role="alert" className="text-error-deep text-copy-sm">
                  {amountError.message ?? t("amountInvalid")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="withdraw-bank">{t("bankLabel")}</Label>
              <Input
                id="withdraw-bank"
                autoComplete="off"
                disabled={requestingWithdrawal}
                aria-invalid={bankError ? true : undefined}
                {...form.register("bankName")}
              />
              {bankError ? (
                <p role="alert" className="text-error-deep text-copy-sm">
                  {t("bankInvalid")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="withdraw-last4">{t("last4Label")}</Label>
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
                {...form.register("accountLast4")}
              />
              {last4Error ? (
                <p role="alert" className="text-error-deep text-copy-sm">
                  {t("last4Invalid")}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={requestingWithdrawal}
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                metal="live"
                className="min-h-11"
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
