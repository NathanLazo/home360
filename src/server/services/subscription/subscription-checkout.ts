import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import type { PlanCode } from "~/lib/subscription/plan-codes";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { ensureStripeCustomer } from "./billing";
import {
  getRenewsAt,
  mapStripeSubscriptionStatus,
} from "./subscription-status";

export type SubscriptionCheckoutDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type SubscriptionCheckoutErrorCode =
  | "BUSINESS_NOT_ACTIVE"
  | "PLAN_NOT_FOUND"
  | "PLAN_NOT_SYNCED"
  | "ALREADY_SUBSCRIBED";

/**
 * Remote states that no longer bill anyone. `incomplete` is the legacy
 * `default_incomplete` alta (pre-Checkout): it never got a first payment and
 * Stripe expires it after ~23 h, so the business may replace it.
 */
const REPLACEABLE_REMOTE_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["incomplete", "incomplete_expired", "canceled"]);

function customerIdOf(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

/**
 * Whether the business already has a remote subscription that bills it. A
 * Checkout on top of it would charge twice, so it must go through
 * `changePlan` or the Portal instead.
 */
async function hasLiveRemoteSubscription(
  deps: SubscriptionCheckoutDeps,
  stripeSubscriptionId: string,
): Promise<boolean> {
  try {
    const remote =
      await deps.stripe.subscriptions.retrieve(stripeSubscriptionId);

    return !REPLACEABLE_REMOTE_STATUSES.has(remote.status);
  } catch (error) {
    // A subscription deleted on Stripe's side no longer bills anyone.
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return false;
    }

    throw error;
  }
}

/**
 * Opens a Stripe Checkout Session (mode `subscription`) for the plan the
 * business picked (`PENDIENTES.md` §8, revised 2026-11-19).
 *
 * The business chooses its own plan and pays on Stripe's hosted page, where
 * it can also redeem a promotion code. With `payment_method_collection:
 * "if_required"` a 100 % discount activates the subscription without a card.
 * Nothing is persisted here: the subscription only exists locally once
 * `checkout.session.completed` binds it (`bindCheckoutSubscription`).
 */
export async function createSubscriptionCheckout(
  deps: SubscriptionCheckoutDeps,
  input: {
    businessId: string;
    planCode: PlanCode;
    locale: "es" | "en";
    successUrl: string;
    cancelUrl: string;
  },
): Promise<ServiceResult<{ url: string }, SubscriptionCheckoutErrorCode>> {
  const business = await deps.db.business.findUnique({
    where: { id: input.businessId },
    select: {
      status: true,
      subscription: { select: { stripeSubscriptionId: true } },
    },
  });

  if (!business) {
    return svcFail("NOT_FOUND", "Business not found");
  }

  if (business.status !== "ACTIVE") {
    return svcFail("BUSINESS_NOT_ACTIVE", "Business is not approved");
  }

  const plan = await deps.db.plan.findUnique({
    where: { code: input.planCode },
    select: { stripePriceId: true },
  });

  if (!plan) {
    return svcFail("PLAN_NOT_FOUND", "Plan not found");
  }

  if (!plan.stripePriceId) {
    return svcFail("PLAN_NOT_SYNCED", "Plan has no Stripe price");
  }

  try {
    const currentRemoteId = business.subscription?.stripeSubscriptionId;

    if (
      currentRemoteId &&
      (await hasLiveRemoteSubscription(deps, currentRemoteId))
    ) {
      return svcFail("ALREADY_SUBSCRIBED", "Business already has a plan");
    }

    const customer = await ensureStripeCustomer(deps, {
      businessId: input.businessId,
    });

    if (!customer.ok) {
      return customer;
    }

    const metadata = {
      businessId: input.businessId,
      planCode: input.planCode,
    };

    const session = await deps.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.data.stripeCustomerId,
      client_reference_id: input.businessId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
      locale: input.locale,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata,
      subscription_data: { metadata },
    });

    if (!session.url) {
      return svcFail("STRIPE_ERROR", "Checkout Session has no URL");
    }

    return svcOk({ url: session.url });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing] SUBSCRIPTION_CHECKOUT_FAILED", {
        businessId: input.businessId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Checkout Session could not be created");
    }

    throw error;
  }
}

/**
 * Binds the subscription created by a completed Checkout Session to the local
 * row of its business, creating the row on the first plan.
 *
 * The business is resolved from the Billing customer persisted by
 * `ensureStripeCustomer`, never from metadata. Sessions of other customers
 * (corporate memberships share the endpoint) are a success with no effect.
 * The write is absolute, so a replayed event converges.
 */
export async function bindCheckoutSubscription(
  deps: SubscriptionCheckoutDeps,
  session: Stripe.Checkout.Session,
): Promise<ServiceResult<{ subscriptionId: string | null }>> {
  if (session.mode !== "subscription" || session.status !== "complete") {
    return svcOk({ subscriptionId: null });
  }

  const customerId = customerIdOf(session.customer);

  if (!customerId) {
    return svcOk({ subscriptionId: null });
  }

  const business = await deps.db.business.findUnique({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      subscription: { select: { id: true, stripeSubscriptionId: true } },
    },
  });

  if (!business) {
    return svcOk({ subscriptionId: null });
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  if (!stripeSubscriptionId) {
    return svcFail("CONFLICT", `Session ${session.id} has no subscription`);
  }

  // Stripe is the source of truth for status, price and period.
  const remote = await deps.stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = remote.items.data[0]?.price.id;
  const plan = priceId
    ? await deps.db.plan.findUnique({
        where: { stripePriceId: priceId },
        select: { id: true },
      })
    : null;

  if (!plan) {
    return svcFail("CONFLICT", `Subscription ${remote.id} has no known plan`);
  }

  const status = mapStripeSubscriptionStatus(remote.status);
  const renewsAt = getRenewsAt(remote) ?? new Date();
  const previousRemoteId = business.subscription?.stripeSubscriptionId ?? null;

  const local = await deps.db.subscription.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      planId: plan.id,
      status,
      renewsAt,
      stripeSubscriptionId: remote.id,
    },
    update: {
      planId: plan.id,
      status,
      renewsAt,
      stripeSubscriptionId: remote.id,
    },
    select: { id: true },
  });

  if (previousRemoteId && previousRemoteId !== remote.id) {
    await retirePreviousSubscription(deps, {
      businessId: business.id,
      previousRemoteId,
    });
  }

  return svcOk({ subscriptionId: local.id });
}

/**
 * Cancels the replaced remote subscription when it never billed (legacy
 * `incomplete`), so it cannot expire later as noise. A live one is never
 * touched automatically: two live subscriptions are an operational incident,
 * logged for triage instead of guessing which charge to keep.
 */
async function retirePreviousSubscription(
  deps: SubscriptionCheckoutDeps,
  input: { businessId: string; previousRemoteId: string },
): Promise<void> {
  try {
    const previous = await deps.stripe.subscriptions.retrieve(
      input.previousRemoteId,
    );

    if (previous.status === "incomplete") {
      await deps.stripe.subscriptions.cancel(previous.id);
      return;
    }

    if (!REPLACEABLE_REMOTE_STATUSES.has(previous.status)) {
      console.error("[billing] DUPLICATE_LIVE_SUBSCRIPTION", {
        businessId: input.businessId,
        previousRemoteId: previous.id,
        previousStatus: previous.status,
      });
    }
  } catch (error) {
    // Best-effort: the new subscription is already bound.
    console.error("[billing] RETIRE_PREVIOUS_SUBSCRIPTION_FAILED", {
      businessId: input.businessId,
      code: error instanceof Stripe.errors.StripeError ? error.code : null,
    });
  }
}
