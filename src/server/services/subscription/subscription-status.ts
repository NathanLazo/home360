import "server-only";

import type Stripe from "stripe";

import type { SubscriptionStatus } from "@generated/prisma";

/**
 * Every Stripe subscription status mapped onto the three local ones.
 *
 * `Stripe.Subscription.Status` includes `OtherString`
 * (`string & Record<never, never>`) so the SDK stays forward compatible, which
 * collapses the union to `string` for both exhaustiveness checks and key
 * validation: neither an exhaustive `switch` nor a `satisfies Record<Status,…>`
 * can be enforced by the compiler here. The list below is therefore the
 * documented contract, and the runtime fallback covers anything Stripe adds.
 *
 * `incomplete` maps to `PAST_DUE`, not `CANCELED`: with the Customer Portal
 * model (`PENDIENTES.md` §8) a subscription is born `incomplete` until the
 * business adds a card, and the business must stay fully operational with a
 * banner meanwhile. Only a genuinely dead subscription degrades the account to
 * read-only.
 */
const STATUS_MAP: Record<string, SubscriptionStatus | undefined> = {
  active: "ACTIVE",
  trialing: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  incomplete: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "CANCELED",
  paused: "CANCELED",
};

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  const mapped = STATUS_MAP[status];

  if (mapped === undefined) {
    // Unknown future status: keep the business operating with a banner rather
    // than locking it out of its own account.
    console.error("[billing] UNKNOWN_SUBSCRIPTION_STATUS", { status });
    return "PAST_DUE";
  }

  return mapped;
}

/**
 * Reads the end of the current billing period.
 *
 * Since API version `2025-03-31`, `current_period_end` lives on each
 * subscription item instead of on the subscription. A HOME360 subscription
 * always has exactly one item (one plan = one price, F4-03), but the latest
 * period end across items is taken so an unexpected extra item can never
 * shorten the renewal date. Without items there is no knowable renewal date, so
 * the caller gets `null` and keeps whatever it had stored.
 */
export function getRenewsAt(subscription: Stripe.Subscription): Date | null {
  const periodEnds = subscription.items.data.map(
    (item) => item.current_period_end,
  );

  if (periodEnds.length === 0) {
    return null;
  }

  return new Date(Math.max(...periodEnds) * 1000);
}
