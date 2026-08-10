import "server-only";

import type Stripe from "stripe";

import type { PrismaClient } from "../../../../generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { handleAccountUpdated } from "./handlers/account-updated";
import { billingHandlers } from "./handlers/billing-handlers";
import { handleChargeRefunded } from "./handlers/charge-refunded";
import { handleCheckoutSessionCompleted } from "./handlers/checkout-session-completed";
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

const stripeEventHandlers = new Map<string, StripeEventHandler>();

/**
 * Registers handlers by Stripe event type.
 *
 * Later phases (for example Billing in F4) extend the webhook by calling this
 * function from their own module; the route handler never changes.
 */
export function registerStripeHandlers(
  handlers: Record<string, StripeEventHandler>,
): void {
  for (const [eventType, handler] of Object.entries(handlers)) {
    stripeEventHandlers.set(eventType, handler);
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

/**
 * Routes a verified Stripe event to its handler.
 *
 * An unknown event type is a success with no effect so Stripe stops retrying
 * events this application deliberately ignores.
 */
export async function dispatchStripeEvent(
  deps: StripeWebhookDeps,
  event: Stripe.Event,
): Promise<ServiceResult<null>> {
  const handler = stripeEventHandlers.get(event.type);

  if (handler === undefined) {
    return svcOk(null);
  }

  try {
    const outcome = await handler(deps, event);

    if (!outcome.ok) {
      console.error("[stripe-webhook] HANDLER_FAILED", {
        eventId: event.id,
        eventType: event.type,
        code: outcome.code,
        detail: outcome.detail,
      });
    }

    return outcome;
  } catch (error) {
    console.error("[stripe-webhook] HANDLER_THREW", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "unknown error",
    });

    return svcFail("CONFLICT", "Stripe webhook handler threw");
  }
}
