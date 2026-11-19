import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

export const requestsTabSchema = z.enum(["radar", "offers"]);
export type RequestsTab = z.infer<typeof requestsTabSchema>;

export const quoteStatusFilterSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "WITHDRAWN",
]);
export type QuoteStatusFilter = z.infer<typeof quoteStatusFilterSchema>;

export const OFFER_MESSAGE_MAX = 500;

/** Upper bound of any amount typed in pesos (mirrors the server cap). */
const MAX_PESOS = 10_000_000;

/** Pesos typed by the user → cents, or `null` when not a valid amount. */
function toCents(value: string): number | null {
  if (value.trim() === "") return null;
  const pesos = Number(value);
  if (!Number.isFinite(pesos) || pesos <= 0 || pesos > MAX_PESOS) return null;
  return Math.round(pesos * 100);
}

export type OfferFormValues = {
  workerId: string;
  /** Empty string = no linked catalog service. */
  serviceId: string;
  /** Total job price; optional only when a diagnostic is charged first. */
  price: string;
  diagnosticEnabled: boolean;
  diagnosticPrice: string;
  /** Diagnostic deducted from the final charge after the visit. */
  diagnosticCredited: boolean;
  scheduledAt: string;
  message: string;
};

/** Fields that can carry a validation error. */
export type OfferFormField =
  "workerId" | "price" | "diagnosticPrice" | "scheduledAt" | "message";

/**
 * Client-side mirror of `quote.submit`: amounts are typed in pesos and the
 * schedule comes from a `datetime-local` input (viewer's local time). Escrow
 * needs an amount on acceptance, so the price may stay empty only when the
 * offer charges a diagnostic first.
 */
export const offerFormSchema = z
  .object({
    workerId: recordIdSchema,
    serviceId: z.union([recordIdSchema, z.literal("")]),
    price: z.string().trim(),
    diagnosticEnabled: z.boolean(),
    diagnosticPrice: z.string().trim(),
    diagnosticCredited: z.boolean(),
    scheduledAt: z
      .string()
      .min(1)
      .transform((value) => new Date(value))
      .refine((date) => !Number.isNaN(date.getTime()))
      .refine((date) => date.getTime() > Date.now()),
    message: z.string().trim().max(OFFER_MESSAGE_MAX),
  })
  .superRefine((values, context) => {
    const priceMissing = values.price === "" && !values.diagnosticEnabled;
    if (
      priceMissing ||
      (values.price !== "" && toCents(values.price) === null)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["price"] });
    }
    if (values.diagnosticEnabled && toCents(values.diagnosticPrice) === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diagnosticPrice"],
      });
    }
  })
  .transform((values) => {
    const diagnosticCents = values.diagnosticEnabled
      ? toCents(values.diagnosticPrice)
      : null;

    return {
      workerId: values.workerId,
      serviceId: values.serviceId === "" ? undefined : values.serviceId,
      priceCents: toCents(values.price) ?? undefined,
      diagnostic:
        diagnosticCents === null
          ? null
          : {
              priceCents: diagnosticCents,
              credited: values.diagnosticCredited,
            },
      scheduledAt: values.scheduledAt,
      message: values.message === "" ? undefined : values.message,
    };
  });

export type ParsedOffer = z.output<typeof offerFormSchema>;
