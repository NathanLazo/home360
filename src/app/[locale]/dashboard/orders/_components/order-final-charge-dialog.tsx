"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { LoaderCircleIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { finalChargeBreakdown, parsePesosToCents } from "./final-charge.utils";
import { useMoney } from "~/hooks/use-money";
import { useErrorShake } from "~/components/motion";
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

/**
 * "Emitir cargo final" of a diagnostic order: the business types the full
 * job price and sees, live, the credit and what the customer will pay. The
 * server re-computes the credit; this preview never decides money.
 */
export function OrderFinalChargeDialog({
  open,
  folio,
  diagnosticCents,
  credited,
  estimatedJobCents,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  folio: number;
  diagnosticCents: number;
  credited: boolean;
  estimatedJobCents: number | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (finalAmountCents: number) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.orders.actions.finalChargeDialog");
  const money = useMoney();
  const shakeInvalid = useErrorShake();
  const amountId = useId();
  const errorId = `${amountId}-error`;
  const [amount, setAmount] = useState("");
  const [invalid, setInvalid] = useState(false);
  const finalCents = parsePesosToCents(amount);
  const breakdown = finalChargeBreakdown({
    finalCents: finalCents ?? 0,
    diagnosticCents,
    credited,
  });

  useEffect(() => {
    if (!open) {
      setAmount("");
      setInvalid(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (finalCents === null || breakdown.customerPaysCents <= 0) {
      setInvalid(true);
      shakeInvalid(event.currentTarget);
      document.getElementById(amountId)?.focus();
      return;
    }

    const done = await onConfirm(finalCents);
    if (done) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("title", { folio })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={amountId}>{t("amountLabel")}</Label>
            <Input
              id={amountId}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              autoFocus
              value={amount}
              disabled={loading}
              placeholder={t("amountPlaceholder")}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              onChange={(event) => {
                setAmount(event.target.value);
                setInvalid(false);
              }}
              className="font-mono tabular-nums"
            />
            {invalid ? (
              <p
                id={errorId}
                role="alert"
                className="text-destructive text-copy-sm"
              >
                {t("amountError")}
              </p>
            ) : estimatedJobCents !== null ? (
              <p className="text-muted-foreground text-xs">
                {t("estimateHint", { amount: money(estimatedJobCents) })}
              </p>
            ) : null}
          </div>

          <dl className="bg-canvas-soft text-copy-sm space-y-2 rounded-xl border p-4">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("finalLine")}</dt>
              <dd className="font-mono tabular-nums">
                {money(finalCents ?? 0)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {t(credited ? "creditLine" : "noCreditLine")}
              </dt>
              <dd className="text-muted-foreground font-mono tabular-nums">
                {credited ? `−${money(diagnosticCents)}` : money(0)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t pt-2">
              <dt className="font-medium">{t("totalLine")}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {money(Math.max(breakdown.customerPaysCents, 0))}
              </dd>
            </div>
          </dl>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              metal="live"
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ReceiptTextIcon aria-hidden="true" />
              )}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
