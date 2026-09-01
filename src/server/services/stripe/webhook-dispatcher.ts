import "server-only";

import type Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { handleAccountUpdated } from "./handlers/account-updated";
import { billingHandlers } from "./handlers/billing-handlers";
import { handleChargeRefunded } from "./handlers/charge-refunded";
import { handleCheckoutSessionCompleted } from "./handlers/checkout-session-completed";
import { corporateBillingHandlers } from "./handlers/corporate-billing-handlers";
import { handlePaymentIntentSucceeded } from "./handlers/payment-intent-succeeded";
import {
  handlePayoutCanceled,
  handlePayoutFailed,
} from "./handlers/payout-reconciliation";

export type StripeWebhookDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type StripeEventHandler = (
  deps: StripeWebhookDeps,
  event: Stripe.Event,
) => Promise<ServiceResult<null>>;

const stripeEventHandlers = new Map<string, StripeEventHandler[]>();

/**
 * Registers handlers by Stripe event type.
 *
 * Later phases (for example Billing in F4, corporate Billing in F7) extend the
 * webhook by calling this function from their own module; the route handler
 * never changes. Several domains may claim the same event type: registration
 * appends instead of overwriting, and a handler that does not recognize its
 * domain resolves as a success with no effect so the next one still runs.
 */
export function registerStripeHandlers(
  handlers: Record<string, StripeEventHandler>,
): void {
  for (const [eventType, handler] of Object.entries(handlers)) {
    const registered = stripeEventHandlers.get(eventType) ?? [];

    registered.push(handler);
    stripeEventHandlers.set(eventType, registered);
  }
}

registerStripeHandlers({
  "account.updated": handleAccountUpdated,
  "charge.refunded": handleChargeRefunded,
  "checkout.session.completed": handleCheckoutSessionCompleted,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payout.canceled": handlePayoutCanceled,
  "payout.failed": handlePayoutFailed,
});

registerStripeHandlers(billingHandlers);
registerStripeHandlers(corporateBillingHandlers);

/**
 * Routes a verified Stripe event to every registered handler.
 *
 * An unknown event type is a success with no effect so Stripe stops retrying
 * events this application deliberately ignores. Every handler always runs: a
 * failure in one domain does not stop another domain from converging, but any
 * failure still surfaces (first one wins) so the route answers 500 and Stripe
 * redelivers the event to all of them — each handler is idempotent.
 */
export async function dispatchStripeEvent(
  deps: StripeWebhookDeps,
  event: Stripe.Event,
): Promise<ServiceResult<null>> {
  const handlers = stripeEventHandlers.get(event.type);

  if (handlers === undefined || handlers.length === 0) {
    return svcOk(null);
  }

  let firstFailure: ServiceResult<null> | null = null;

  for (const handler of handlers) {
    try {
      const outcome = await handler(deps, event);

      if (!outcome.ok) {
        console.error("[stripe-webhook] HANDLER_FAILED", {
          eventId: event.id,
          eventType: event.type,
          code: outcome.code,
          detail: outcome.detail,
        });

        firstFailure ??= outcome;
      }
    } catch (error) {
      console.error("[stripe-webhook] HANDLER_THREW", {
        eventId: event.id,
        eventType: event.type,
        message: error instanceof Error ? error.message : "unknown error",
      });

      firstFailure ??= svcFail("CONFLICT", "Stripe webhook handler threw");
    }
  }

  return firstFailure ?? svcOk(null);
}
