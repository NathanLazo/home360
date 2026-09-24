"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import type { AiCreditPack } from "./profile.types";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { usdMicrosToUsd } from "~/lib/agent/agent-pricing";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type PackCode = AiCreditPack["code"];

/**
 * Pack picker → Stripe Checkout. The pay button is the page's one live metal
 * (the beam outside hands over while this is open). Radio cards use native
 * inputs: arrows move, Space selects, focus ring follows the real control.
 */
export function BuyCreditsDialog({
  open,
  onOpenChange,
  packs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packs: AiCreditPack[];
}) {
  const t = useTranslations("profile.billing.packs");
  const errors = useTranslations("errors");
  const feedback = useTranslations("profile.feedback");
  const format = useFormatter();
  const [selected, setSelected] = useState<PackCode | null>(
    packs[1]?.code ?? packs[0]?.code ?? null,
  );
  const [redirecting, setRedirecting] = useState(false);
  const checkout = api.aiBilling.createCreditCheckout.useMutation();
  const pending = checkout.isPending || redirecting;
  const pack = packs.find((candidate) => candidate.code === selected) ?? null;
  const usd = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "USD" });

  async function handlePay() {
    if (!pack) return;

    try {
      const response = await checkout.mutateAsync({
        packCode: pack.code,
        lineItemLabel: t("lineItem", { code: pack.code }),
      });

      if (response.error !== null || response.result === null) {
        toast.error(errors(response.error ?? "UNKNOWN_ERROR"));
        return;
      }

      setRedirecting(true);
      window.location.assign(response.result.url);
    } catch {
      toast.error(feedback("transportError"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2" disabled={pending}>
          <legend className="sr-only">{t("group")}</legend>
          {packs.map((candidate) => (
            <label
              key={candidate.code}
              className={cn(
                "group border-hairline bg-card flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-[border-color,box-shadow] duration-150 ease-out",
                "hover:border-hairline-strong has-checked:border-foreground has-checked:shadow-hairline",
                "has-focus-visible:ring-ring has-focus-visible:ring-offset-background has-focus-visible:ring-2 has-focus-visible:ring-offset-2",
                "active:scale-[0.99] has-disabled:cursor-not-allowed has-disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
              )}
            >
              <input
                type="radio"
                name="packCode"
                value={candidate.code}
                checked={selected === candidate.code}
                onChange={() => setSelected(candidate.code)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="border-hairline-strong group-has-checked:border-foreground size-4 shrink-0 rounded-full border-2 transition-[border-width,border-color] duration-150 ease-out group-has-checked:border-[5px] motion-reduce:transition-none"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-copy-sm font-medium">
                  {t("label", { code: candidate.code })}
                </span>
                <span className="text-muted-foreground text-label font-mono">
                  {t("credit", {
                    amount: format.number(
                      usdMicrosToUsd(candidate.creditUsdMicros),
                      { style: "currency", currency: "USD" },
                    ),
                  })}
                </span>
              </span>
              <span className="text-copy-sm shrink-0 font-mono tabular-nums">
                {usd(candidate.amountUsdCents)}
              </span>
            </label>
          ))}
        </fieldset>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            metal="live"
            disabled={!pack}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            className="aria-disabled:cursor-progress"
            onClick={() => {
              if (!pending) void handlePay();
            }}
          >
            {pending ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {pending
              ? t("redirecting")
              : pack
                ? t("pay", { amount: usd(pack.amountUsdCents) })
                : t("title")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
