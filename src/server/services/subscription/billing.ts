import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import {
  getRenewsAt,
  mapStripeSubscriptionStatus,
} from "./subscription-status";

export type BillingDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type EnsureSubscriptionErrorCode =
  | "NO_SUBSCRIPTION"
  | "PLAN_NOT_SYNCED"
  | "NOT_FOUND";

/**
 * Creates or returns the Stripe Billing customer of a business.
 *
 * A Billing customer is a different object from the Connect account
 * (`Business.stripeAccountId`): the first one pays HOME360, the second one
 * receives money from HOME360.
 */
export async function ensureStripeCustomer(
  deps: BillingDeps,
  input: { businessId: string },
): Promise<ServiceResult<{ stripeCustomerId: string }, "NOT_FOUND">> {
  const business = await deps.db.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      owner: { select: { email: true } },
    },
  });

  if (!business) {
    return svcFail("NOT_FOUND", "Business not found");
  }

  if (business.stripeCustomerId) {
    return svcOk({ stripeCustomerId: business.stripeCustomerId });
  }

  try {
    const customer = await deps.stripe.customers.create(
      {
        name: business.name,
        email: business.owner.email ?? undefined,
        metadata: { businessId: business.id },
      },
      { idempotencyKey: `billing-customer-${business.id}` },
    );

    // Conditional write: a concurrent request that already persisted its own
    // customer keeps it, and this call converges on the stored value.
    const written = await deps.db.business.updateMany({
      where: { id: business.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });

    if (written.count === 0) {
      const current = await deps.db.business.findUnique({
        where: { id: business.id },
        select: { stripeCustomerId: true },
      });

      if (!current?.stripeCustomerId) {
        return svcFail("CONFLICT", "Business lost its Stripe customer");
      }

      return svcOk({ stripeCustomerId: current.stripeCustomerId });
    }

    return svcOk({ stripeCustomerId: customer.id });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing] CUSTOMER_CREATE_FAILED", {
        businessId: business.id,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe customer could not be created");
    }

    throw error;
  }
}

/**
 * Brings the Stripe Billing subscription of a business into existence.
 *
 * Repair-style service: `approveBusiness` (F5-05) creates the local row and
 * calls this best-effort after the commit, and any later flow may call it again
 * without creating a second remote subscription.
 *
 * Billing model approved in `PENDIENTES.md` §8 (Stripe Billing Customer
 * Portal): the subscription is created with `charge_automatically` and
 * `default_incomplete`, so it is born `incomplete` (→ local `PAST_DUE`) and
 * starts charging as soon as the business adds a card in the hosted Portal.
 * HOME360 never renders card fields.
 */
export async function ensureBillingSubscription(
  deps: BillingDeps,
  input: { businessId: string },
): Promise<
  ServiceResult<
    { stripeSubscriptionId: string; renewsAt: Date; created: boolean },
    EnsureSubscriptionErrorCode
  >
> {
  const subscription = await deps.db.subscription.findUnique({
    where: { businessId: input.businessId },
    select: {
      id: true,
      status: true,
      stripeSubscriptionId: true,
      renewsAt: true,
      plan: { select: { code: true, stripePriceId: true } },
    },
  });

  if (!subscription) {
    return svcFail("NO_SUBSCRIPTION", "Business has no local subscription");
  }

  if (subscription.stripeSubscriptionId) {
    return svcOk({
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      renewsAt: subscription.renewsAt,
      created: false,
    });
  }

  // Detected before touching Stripe: Roger has not run `sync-stripe-plans`.
  if (!subscription.plan.stripePriceId) {
    return svcFail("PLAN_NOT_SYNCED", "Plan has no Stripe price");
  }

  const customer = await ensureStripeCustomer(deps, {
    businessId: input.businessId,
  });

  if (!customer.ok) {
    return customer;
  }

  try {
    const created = await deps.stripe.subscriptions.create(
      {
        customer: customer.data.stripeCustomerId,
        items: [{ price: subscription.plan.stripePriceId }],
        collection_method: "charge_automatically",
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        metadata: {
          businessId: input.businessId,
          subscriptionId: subscription.id,
          planCode: subscription.plan.code,
        },
      },
      // Derived from the local id: a retry after a crash returns the same
      // remote subscription instead of creating a second one.
      { idempotencyKey: `billing-subscription-${subscription.id}` },
    );

    const renewsAt = getRenewsAt(created) ?? subscription.renewsAt;

    await deps.db.subscription.updateMany({
      where: { id: subscription.id, stripeSubscriptionId: null },
      data: {
        stripeSubscriptionId: created.id,
        status: mapStripeSubscriptionStatus(created.status),
        renewsAt,
      },
    });

    return svcOk({
      stripeSubscriptionId: created.id,
      renewsAt,
      created: true,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing] SUBSCRIPTION_CREATE_FAILED", {
        businessId: input.businessId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription could not be created");
    }

    throw error;
  }
}

/**
 * Opens a Stripe Billing Customer Portal session.
 *
 * The Portal is the only place where a business adds or changes its card, reads
 * its invoices and cancels or resumes the subscription (`PENDIENTES.md` §8), so
 * it must stay reachable for a `CANCELED` subscription too. `returnUrl` is
 * built by the caller from `APP_URL`; services never read env.
 */
export async function createBillingPortalSession(
  deps: BillingDeps,
  input: { businessId: string; returnUrl: string },
): Promise<ServiceResult<{ url: string }, "NOT_FOUND">> {
  const customer = await ensureStripeCustomer(deps, {
    businessId: input.businessId,
  });

  if (!customer.ok) {
    return customer;
  }

  try {
    const session = await deps.stripe.billingPortal.sessions.create({
      customer: customer.data.stripeCustomerId,
      return_url: input.returnUrl,
    });

    return svcOk({ url: session.url });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing] PORTAL_SESSION_FAILED", {
        businessId: input.businessId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Billing portal session failed");
    }

    throw error;
  }
}
