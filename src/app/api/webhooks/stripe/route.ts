import type Stripe from "stripe";

import { env } from "~/env";
import { db } from "~/server/db";
import { getStripe } from "~/server/services/stripe/client";
import { dispatchStripeEvent } from "~/server/services/stripe/webhook-dispatcher";

/** Signature verification needs Node crypto, not the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // RAW body first: any req.json() here would consume the stream the signature
  // is computed over.
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (signature === null) {
    return new Response("missing signature", { status: 400 });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (webhookSecret === undefined) {
    console.error("[stripe-webhook] MISSING_WEBHOOK_SECRET");

    return new Response("webhook not configured", { status: 500 });
  }

  let stripe: Stripe;

  try {
    stripe = getStripe();
  } catch {
    console.error("[stripe-webhook] MISSING_STRIPE_CLIENT");

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
