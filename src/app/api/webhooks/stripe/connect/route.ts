import { env } from "~/env";
import { handleStripeWebhook } from "~/server/services/stripe/webhook-route";

/** Signature verification needs Node crypto, not the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connected-account events (Express onboarding `account.updated`, payouts).
 * Stripe signs them with the Connect endpoint secret, not the platform one.
 */
export async function POST(req: Request): Promise<Response> {
  return handleStripeWebhook(req, env.STRIPE_CONNECT_WEBHOOK_SECRET, "connect");
}
