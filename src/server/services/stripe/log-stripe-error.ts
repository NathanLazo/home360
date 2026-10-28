import "server-only";

import type Stripe from "stripe";

/**
 * Services map Stripe failures to the opaque `STRIPE_ERROR` code, so this is
 * the only trace of *why* Stripe refused. Logs the fields Stripe documents as
 * safe to surface (no keys, no payloads) plus the request id for the
 * dashboard's request log.
 */
export function logStripeError(
  operation: string,
  error: Stripe.errors.StripeError,
): void {
  console.error(`[stripe] ${operation} failed`, {
    type: error.type,
    code: error.code ?? null,
    statusCode: error.statusCode ?? null,
    requestId: error.requestId ?? null,
    message: error.message,
  });
}
