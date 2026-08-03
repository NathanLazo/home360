import "server-only";

import Stripe from "stripe";

import { env } from "~/env";

let stripeSingleton: Stripe | undefined;

/**
 * Returns the process-wide Stripe client at an application boundary.
 *
 * Services that use Stripe must receive this instance as a parameter so they
 * remain testable. Only routers, webhooks, and cron jobs should call this
 * function directly.
 */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeSingleton ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-07-29.dahlia",
  });

  return stripeSingleton;
}
