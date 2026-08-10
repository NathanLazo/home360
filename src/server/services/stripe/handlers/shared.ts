import "server-only";

import { z } from "zod";

import type { ServiceResult } from "~/server/services/service-result";

/** Every Stripe webhook handler reports success or a stable failure code. */
export type StripeHandlerResult = ServiceResult<null>;

/** Failure branch shared by every `ServiceResult`, whatever its data type. */
export type StripeHandlerFailure = {
  ok: false;
  code: "STRIPE_ERROR" | "NOT_FOUND" | "CONFLICT";
  detail?: string;
};

/**
 * Adapts a service error code to the handler result contract.
 *
 * `ServiceResult` only admits the base codes without an explicit error type, so
 * any richer code (for example `PAYMENT_NOT_REFUNDABLE`) is preserved inside
 * `detail` and stays visible for operational triage.
 */
export function handlerFail(
  code: string,
  detail?: string,
): StripeHandlerFailure {
  const isBaseCode =
    code === "STRIPE_ERROR" || code === "NOT_FOUND" || code === "CONFLICT";

  if (isBaseCode) {
    return detail === undefined
      ? { ok: false, code }
      : { ok: false, code, detail };
  }

  return {
    ok: false,
    code: "CONFLICT",
    detail: detail === undefined ? code : `${code}: ${detail}`,
  };
}

const identifierSchema = z.string().trim().min(1);
const centsTextSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/);

/**
 * Stripe metadata is attacker-influenced input: it only locates rows, it never
 * authorizes them. Every schema below is intentionally permissive about extra
 * keys because foreign events (Billing, Connect) share the same envelope.
 */
export const paymentIntentMetadataSchema = z.object({
  orderId: identifierSchema.optional(),
  paymentLinkId: identifierSchema.optional(),
  businessId: identifierSchema.optional(),
  providerAmountCents: centsTextSchema.optional(),
});

export const checkoutSessionMetadataSchema = z.object({
  paymentLinkId: identifierSchema.optional(),
  businessId: identifierSchema.optional(),
});

export const refundMetadataSchema = z.object({
  paymentId: identifierSchema,
  providerRefundCents: centsTextSchema,
  serviceFeeRefundCents: centsTextSchema,
});

/** Converts a validated cents string into a safe integer, or `undefined`. */
export function parseCents(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** Stripe expandable fields arrive as an id or as the expanded object. */
export function expandableId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : null;
  }

  return null;
}
