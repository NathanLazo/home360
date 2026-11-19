import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

export type BillingDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

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
 * Returns the remote subscription the business is billed through.
 *
 * Read-only: since `PENDIENTES.md` §8 (revised 2026-11-19) a subscription is
 * only ever created by the business itself through Checkout
 * (`createSubscriptionCheckout`), so a business without one gets
 * `NO_SUBSCRIPTION` and is sent to pick a plan.
 */
export async function getBillingSubscriptionId(
  deps: Pick<BillingDeps, "db">,
  input: { businessId: string },
): Promise<ServiceResult<{ stripeSubscriptionId: string }, "NO_SUBSCRIPTION">> {
  const subscription = await deps.db.subscription.findUnique({
    where: { businessId: input.businessId },
    select: { stripeSubscriptionId: true },
  });

  if (!subscription?.stripeSubscriptionId) {
    return svcFail("NO_SUBSCRIPTION", "Business has no Stripe subscription");
  }

  return svcOk({ stripeSubscriptionId: subscription.stripeSubscriptionId });
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
