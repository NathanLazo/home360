import "server-only";

import type Stripe from "stripe";

import { db } from "~/server/db";
import { getStripe } from "~/server/services/stripe/client";
import { dispatchStripeEvent } from "~/server/services/stripe/webhook-dispatcher";

/**
 * Shared body of the Stripe webhook route handlers.
 *
 * Stripe signs events for the platform account and for connected accounts with
 * different endpoint secrets, so each route passes its own secret and the
 * verified event flows into the same dispatcher.
 */
export async function handleStripeWebhook(
  req: Request,
  webhookSecret: string | undefined,
  scope: "platform" | "connect",
): Promise<Response> {
  // RAW body first: any req.json() here would consume the stream the signature
  // is computed over.
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (signature === null) {
    return new Response("missing signature", { status: 400 });
  }

  if (webhookSecret === undefined) {
    console.error("[stripe-webhook] MISSING_WEBHOOK_SECRET", { scope });

    return new Response("webhook not configured", { status: 500 });
  }

  let stripe: Stripe;

  try {
    stripe = getStripe();
  } catch {
    console.error("[stripe-webhook] MISSING_STRIPE_CLIENT", { scope });

    return new Response("webhook not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  const outcome = await dispatchStripeEvent({ db, stripe }, event);

  // Unhandled event types resolve as success, so Stripe stops retrying them.
  return outcome.ok
    ? Response.json({ received: true })
    : new Response("handler error", { status: 500 });
}
