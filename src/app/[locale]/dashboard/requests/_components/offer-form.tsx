"use client";

import { useId, useState, type FormEvent } from "react";
import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  OFFER_MESSAGE_MAX,
  offerFormSchema,
  type OfferFormField,
  type OfferFormValues,
  type ParsedOffer,
} from "./requests.schema";
import { OfferDiagnosticField } from "./offer-diagnostic-field";
import { OfferServiceField } from "./offer-service-field";
import type { QuotableService, WorkerOption } from "./request.types";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `Date` → `datetime-local` value in the viewer's time zone. */
export function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const EMPTY_OFFER: OfferFormValues = {
  workerId: "",
  serviceId: "",
  price: "",
  diagnosticEnabled: false,
  diagnosticPrice: "",
  diagnosticCredited: true,
  scheduledAt: "",
  message: "",
};

/** Diagnostic terms of a catalog service, as form values. */
function diagnosticFromService(
  service: QuotableService,
): Pick<
  OfferFormValues,
  "diagnosticEnabled" | "diagnosticPrice" | "diagnosticCredited"
> {
  return service.diagnosticPriceCents === null
    ? {
        diagnosticEnabled: false,
        diagnosticPrice: "",
        diagnosticCredited: true,
      }
    : {
        diagnosticEnabled: true,
        diagnosticPrice: String(service.diagnosticPriceCents / 100),
        diagnosticCredited: service.diagnosticCredited,
      };
}

/**
 * Offer composer of N2 on web: technician, optional catalog service, an
 * optional up-front diagnostic (prefilled from the service, editable for this
 * offer only), price, visit date-time and a note for the customer. With a
 * diagnostic the price becomes an optional estimate: the business may price
 * the job after the visit. Validates with the same bounds the server enforces
 * before calling `quote.submit`. `initialValues` is read once: callers
 * remount with a `key` when the stored offer changes.
 */
export function OfferForm({
  initialValues,
  workers,
  services,
  submitting,
  disabled,
  submitLabel,
  onSubmit,
}: {
  initialValues: OfferFormValues;
  workers: WorkerOption[];
  services: QuotableService[];
  submitting: boolean;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (offer: ParsedOffer) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.requests.offerForm");
  const baseId = useId();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<OfferFormField, true>>>(
    {},
  );
  const shakeInvalid = useErrorShake();
  const fieldId = (field: keyof OfferFormValues) => `${baseId}-${field}`;
  const errorId = (field: OfferFormField) => `${baseId}-${field}-error`;
  const priceHintId = `${baseId}-price-hint`;
  const selectedService =
    services.find((service) => service.id === values.serviceId) ?? null;
  const priceOptional = values.diagnosticEnabled;

  function update<TField extends keyof OfferFormValues>(
    field: TField,
    value: OfferFormValues[TField],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  /** A newly linked service brings its diagnostic terms; none keeps them. */
  function selectService(serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    setValues((current) => ({
      ...current,
      serviceId,
      ...(service ? diagnosticFromService(service) : {}),
    }));
    setErrors((current) => ({
      ...current,
      price: undefined,
      diagnosticPrice: undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = offerFormSchema.safeParse(values);

    if (!parsed.success) {
      const next: Partial<Record<OfferFormField, true>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "workerId" ||
          field === "price" ||
          field === "diagnosticPrice" ||
          field === "scheduledAt" ||
          field === "message"
        ) {
          next[field] = true;
        }
      }
      setErrors(next);
      shakeInvalid(formElement);
      const first = parsed.error.issues[0]?.path[0];
      if (typeof first === "string") {
        window.requestAnimationFrame(() =>
          document.getElementById(`${baseId}-${first}`)?.focus(),
        );
      }
      return;
    }

    await onSubmit(parsed.data);
  }

  const busy = submitting || disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-w-0 flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("workerId")}>{t("workerLabel")}</Label>
        {workers.length > 0 ? (
          <Select
            value={values.workerId}
            onValueChange={(value) => update("workerId", value)}
            disabled={busy}
          >
            <SelectTrigger
              id={fieldId("workerId")}
              className="w-full"
              aria-invalid={errors.workerId}
              aria-describedby={
                errors.workerId ? errorId("workerId") : undefined
              }
            >
              <SelectValue placeholder={t("workerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  {worker.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-muted-foreground text-copy-sm">{t("noWorkers")}</p>
        )}
        {errors.workerId ? (
          <p
            id={errorId("workerId")}
            role="alert"
            className="text-destructive text-copy-sm"
          >
            {t("workerError")}
          </p>
        ) : null}
      </div>

      {services.length > 0 ? (
        <OfferServiceField
          id={fieldId("serviceId")}
          value={values.serviceId}
          services={services}
          disabled={busy}
          onChange={selectService}
        />
      ) : null}

      <OfferDiagnosticField
        baseId={baseId}
        enabled={values.diagnosticEnabled}
        price={values.diagnosticPrice}
        credited={values.diagnosticCredited}
        serviceName={
          selectedService?.diagnosticPriceCents != null
            ? selectedService.name
            : null
        }
        disabled={busy}
        invalid={errors.diagnosticPrice === true}
        onEnabledChange={(enabled) => {
          update("diagnosticEnabled", enabled);
          // Without a diagnostic the price is required again.
          setErrors((current) => ({ ...current, diagnosticPrice: undefined }));
        }}
        onPriceChange={(price) => update("diagnosticPrice", price)}
        onCreditedChange={(credited) => update("diagnosticCredited", credited)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={fieldId("price")}>
            {t(priceOptional ? "estimatedPriceLabel" : "priceLabel")}
          </Label>
          <Input
            id={fieldId("price")}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.price}
            disabled={busy}
            placeholder={t("pricePlaceholder")}
            aria-invalid={errors.price}
            aria-describedby={
              errors.price
                ? errorId("price")
                : priceOptional
                  ? priceHintId
                  : undefined
            }
            onChange={(event) => update("price", event.target.value)}
            className="font-mono tabular-nums"
          />
          {priceOptional && !errors.price ? (
            <p
              id={priceHintId}
              className="text-muted-foreground text-xs text-pretty"
            >
              {t("priceOptionalHint")}
            </p>
          ) : null}
          {errors.price ? (
            <p
              id={errorId("price")}
              role="alert"
              className="text-destructive text-copy-sm"
            >
              {t("priceError")}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={fieldId("scheduledAt")}>
            {t("scheduledAtLabel")}
          </Label>
          <Input
            id={fieldId("scheduledAt")}
            type="datetime-local"
            value={values.scheduledAt}
            min={toDateTimeLocal(new Date())}
            disabled={busy}
            aria-invalid={errors.scheduledAt}
            aria-describedby={
              errors.scheduledAt ? errorId("scheduledAt") : undefined
            }
            onChange={(event) => update("scheduledAt", event.target.value)}
            className="min-w-0"
          />
          {errors.scheduledAt ? (
            <p
              id={errorId("scheduledAt")}
              role="alert"
              className="text-destructive text-copy-sm"
            >
              {t("scheduledAtError")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("message")}>{t("messageLabel")}</Label>
        <Textarea
          id={fieldId("message")}
          value={values.message}
          rows={3}
          maxLength={OFFER_MESSAGE_MAX}
          disabled={busy}
          placeholder={t("messagePlaceholder")}
          aria-invalid={errors.message}
          onChange={(event) => update("message", event.target.value)}
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("messageCount", {
            count: values.message.length,
            max: OFFER_MESSAGE_MAX,
          })}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          metal="live"
          disabled={busy || workers.length === 0}
          aria-busy={submitting || undefined}
        >
          {submitting ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <SendIcon aria-hidden="true" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
