"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { parsePesosToCents } from "./payment-amount";
import type { CreatedPaymentLink } from "./payment.types";
import { usePaymentMutations } from "./use-payment-mutations";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
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

const CONCEPT_MIN_LENGTH = 3;
const CONCEPT_MAX_LENGTH = 120;

/**
 * Form-side schema. The router keeps its own server-side schema; this one only
 * guards the shape the user can type, and the amount stays a decimal string
 * until `parsePesosToCents` converts it exactly.
 */
const createPaymentLinkFormSchema = z.object({
  concept: z.string().trim().min(CONCEPT_MIN_LENGTH).max(CONCEPT_MAX_LENGTH),
  amount: z.string().refine((value) => parsePesosToCents(value) !== null),
});

type CreatePaymentLinkFormValues = z.infer<typeof createPaymentLinkFormSchema>;

const EMPTY_VALUES: CreatePaymentLinkFormValues = { concept: "", amount: "" };

export function CreatePaymentLinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.payments.link");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const { createPaymentLink, creatingPaymentLink } = usePaymentMutations();
  const [created, setCreated] = useState<CreatedPaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreatePaymentLinkFormValues>({
    resolver: zodResolver(createPaymentLinkFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      return;
    }

    form.reset(EMPTY_VALUES);
    setCreated(null);
    setCopied(false);
  }, [form, open]);

  const onSubmit = form.handleSubmit(async (values) => {
    const providerAmountCents = parsePesosToCents(values.amount);

    if (providerAmountCents === null) {
      form.setError("amount", { message: t("amountInvalid") });
      return;
    }

    const link = await createPaymentLink({
      concept: values.concept.trim(),
      providerAmountCents,
    });

    if (link) {
      setCreated(link);
      toast.success(t("success"));
    }
  });

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("copied"));
    } catch {
      // Clipboard access can be denied; the URL stays selectable on screen.
      toast.error(t("copyFailed"));
    }
  }

  const conceptError = form.formState.errors.concept;
  const amountError = form.formState.errors.amount;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!creatingPaymentLink) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {created ? t("createdDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="payment-link-url">{t("urlLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="payment-link-url"
                readOnly
                value={created.url}
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 shrink-0"
                aria-label={t("copy")}
                onClick={() => void handleCopy(created.url)}
              >
                {copied ? (
                  <CheckIcon aria-hidden="true" />
                ) : (
                  <CopyIcon aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("singleUseHint")}
            </p>
            <DialogFooter>
              <Button
                type="button"
                className="min-h-11"
                onClick={() => onOpenChange(false)}
              >
                {t("done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-link-concept">{t("conceptLabel")}</Label>
              <Input
                id="payment-link-concept"
                autoComplete="off"
                disabled={creatingPaymentLink}
                aria-invalid={conceptError ? true : undefined}
                aria-describedby={
                  conceptError ? "payment-link-concept-error" : undefined
                }
                {...form.register("concept")}
              />
              {conceptError ? (
                <p
                  id="payment-link-concept-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {t("conceptInvalid")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-link-amount">{t("amountLabel")}</Label>
              <Input
                id="payment-link-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                disabled={creatingPaymentLink}
                className="font-mono tabular-nums"
                aria-invalid={amountError ? true : undefined}
                aria-describedby="payment-link-amount-hint"
                {...form.register("amount")}
              />
              <p
                id="payment-link-amount-hint"
                className="text-muted-foreground text-sm"
              >
                {t("amountHint")}
              </p>
              {amountError ? (
                <p role="alert" className="text-destructive text-sm">
                  {amountError.message ?? t("amountInvalid")}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={creatingPaymentLink}
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={creatingPaymentLink}
              >
                {creatingPaymentLink ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
