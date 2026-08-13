import "server-only";

import Stripe from "stripe";

import {
  CorporateTier,
  type PrismaClient,
  type SubscriptionStatus,
} from "../../../../generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import {
  getRenewsAt,
  mapStripeSubscriptionStatus,
} from "~/server/services/subscription/subscription-status";

/**
 * Corporate Stripe Billing (F7-03).
 *
 * Deliberately parallel to `subscription/billing.ts` instead of reusing it:
 * those functions are typed exclusively for `businessId` and the corporate
 * customer/subscription live on `CorporateAccount`/`CorporateMembership`.
 * The billing model is exactly the one approved in `PENDIENTES.md` §8
 * (Stripe Billing Customer Portal): subscriptions are created with
 * `charge_automatically` + `default_incomplete`, are born `incomplete`
 * (→ local `PAST_DUE`) and start charging once the corporate owner adds a
 * card in the hosted Portal. HOME360 never renders card fields.
 */
export type CorporateBillingDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

const CURRENCY = "mxn";

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Creates or returns the Stripe Billing customer of a corporate account.
 * Metadata carries only local ids, never fiscal data (`taxId` stays local).
 */
export async function ensureCorporateStripeCustomer(
  deps: CorporateBillingDeps,
  input: { accountId: string },
): Promise<ServiceResult<{ stripeCustomerId: string }, "NOT_FOUND">> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      owner: { select: { email: true } },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.stripeCustomerId) {
    return svcOk({ stripeCustomerId: account.stripeCustomerId });
  }

  try {
    const customer = await deps.stripe.customers.create(
      {
        name: account.name,
        email: account.owner.email ?? undefined,
        metadata: { corporateAccountId: account.id },
      },
      { idempotencyKey: `corporate-billing-customer-${account.id}` },
    );

    // Conditional write: a concurrent request that already persisted its own
    // customer keeps it, and this call converges on the stored value.
    const written = await deps.db.corporateAccount.updateMany({
      where: { id: account.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });

    if (written.count === 0) {
      const current = await deps.db.corporateAccount.findUnique({
        where: { id: account.id },
        select: { stripeCustomerId: true },
      });

      if (!current?.stripeCustomerId) {
        return svcFail("CONFLICT", "Corporate account lost its Stripe customer");
      }

      return svcOk({ stripeCustomerId: current.stripeCustomerId });
    }

    return svcOk({ stripeCustomerId: customer.id });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] CUSTOMER_CREATE_FAILED", {
        corporateAccountId: account.id,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe customer could not be created");
    }

    throw error;
  }
}

/**
 * Resolves the monthly Price for the effective terms of an account.
 *
 * Catalog tiers whose fee matches `CorporateTierConfig` use the shared Price
 * synced by `scripts/sync-stripe-corporate-tiers.ts`. `CUSTOM` — and any
 * admin-overridden fee — gets a per-account Price: Prices are immutable, are
 * located by `corporateAccountId` metadata and are never shared between
 * accounts.
 */
export async function ensureCorporateMonthlyPrice(
  deps: CorporateBillingDeps,
  input: {
    accountId: string;
    tier: CorporateTier;
    monthlyFeeCents: number;
  },
): Promise<ServiceResult<{ stripePriceId: string }, "PLAN_NOT_SYNCED">> {
  if (input.tier !== CorporateTier.CUSTOM) {
    const config = await deps.db.corporateTierConfig.findUnique({
      where: { tier: input.tier },
      select: { monthlyFeeCents: true, stripePriceId: true },
    });

    if (config?.monthlyFeeCents === input.monthlyFeeCents) {
      if (!config.stripePriceId) {
        // Roger has not run `sync-stripe-corporate-tiers` yet.
        return svcFail("PLAN_NOT_SYNCED", "Tier has no Stripe price");
      }

      return svcOk({ stripePriceId: config.stripePriceId });
    }
    // Overridden fee: fall through to the per-account Price.
  }

  try {
    const found = await deps.stripe.products.search({
      query: `active:'true' AND metadata['corporateAccountId']:'${input.accountId}'`,
      limit: 1,
    });

    const productId =
      found.data[0]?.id ??
      (
        await deps.stripe.products.create(
          {
            name: `HOME360 corporate membership ${input.accountId}`,
            metadata: { corporateAccountId: input.accountId },
          },
          { idempotencyKey: `corporate-product-${input.accountId}` },
        )
      ).id;

    const prices = await deps.stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });
    const existing = prices.data.find(
      (price) =>
        price.currency === CURRENCY &&
        price.unit_amount === input.monthlyFeeCents &&
        price.recurring?.interval === "month" &&
        price.recurring.interval_count === 1,
    );

    if (existing) {
      return svcOk({ stripePriceId: existing.id });
    }

    const price = await deps.stripe.prices.create(
      {
        product: productId,
        currency: CURRENCY,
        unit_amount: input.monthlyFeeCents,
        recurring: { interval: "month" },
        metadata: { corporateAccountId: input.accountId },
      },
      {
        idempotencyKey: `corporate-price-${input.accountId}-${input.monthlyFeeCents}`,
      },
    );

    return svcOk({ stripePriceId: price.id });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] PRICE_RESOLUTION_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Corporate price could not be resolved");
    }

    throw error;
  }
}

export type CorporateSubscriptionSnapshot = {
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  renewsAt: Date | null;
};

/**
 * Creates the corporate Billing subscription (F4-03 contract, corporate ids).
 * The idempotency key derives from the local membership id, so a retry after a
 * crash returns the same remote subscription instead of creating a second one.
 */
export async function createCorporateBillingSubscription(
  deps: CorporateBillingDeps,
  input: {
    accountId: string;
    membershipId: string;
    tier: CorporateTier;
    stripePriceId: string;
  },
): Promise<ServiceResult<CorporateSubscriptionSnapshot, "NOT_FOUND">> {
  const customer = await ensureCorporateStripeCustomer(deps, {
    accountId: input.accountId,
  });

  if (!customer.ok) {
    return customer;
  }

  try {
    const created = await deps.stripe.subscriptions.create(
      {
        customer: customer.data.stripeCustomerId,
        items: [{ price: input.stripePriceId }],
        collection_method: "charge_automatically",
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        metadata: {
          corporateAccountId: input.accountId,
          corporateMembershipId: input.membershipId,
          corporateTier: input.tier,
        },
      },
      { idempotencyKey: `corporate-billing-subscription-${input.membershipId}` },
    );

    return svcOk({
      stripeSubscriptionId: created.id,
      status: mapStripeSubscriptionStatus(created.status),
      renewsAt: getRenewsAt(created),
    });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] SUBSCRIPTION_CREATE_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription could not be created");
    }

    throw error;
  }
}

/**
 * Retrieves the remote subscription of a membership by id. Used by the F7-07
 * reconciliation to converge the local row on the authoritative Stripe state.
 */
export async function retrieveCorporateSubscription(
  deps: CorporateBillingDeps,
  input: { accountId: string; stripeSubscriptionId: string },
): Promise<ServiceResult<{ subscription: Stripe.Subscription }, never>> {
  try {
    const subscription = await deps.stripe.subscriptions.retrieve(
      input.stripeSubscriptionId,
    );

    return svcOk({ subscription });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] SUBSCRIPTION_RETRIEVE_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription could not be read");
    }

    throw error;
  }
}

/**
 * Looks for a remote subscription created for a membership whose id was never
 * persisted locally (crash between the remote creation and the local write).
 * Metadata only orients the search inside the customer's own subscriptions —
 * the caller already proved the customer belongs to the account.
 */
export async function findCorporateSubscriptionForMembership(
  deps: CorporateBillingDeps,
  input: {
    accountId: string;
    membershipId: string;
    stripeCustomerId: string;
  },
): Promise<ServiceResult<{ subscription: Stripe.Subscription | null }, never>> {
  try {
    const subscriptions = await deps.stripe.subscriptions.list({
      customer: input.stripeCustomerId,
      status: "all",
      limit: 100,
    });
    const subscription =
      subscriptions.data.find(
        (candidate) =>
          candidate.metadata.corporateMembershipId === input.membershipId &&
          candidate.metadata.corporateAccountId === input.accountId,
      ) ?? null;

    return svcOk({ subscription });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] SUBSCRIPTION_LOOKUP_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscriptions could not be listed");
    }

    throw error;
  }
}

/**
 * Reads the single subscription item. "One membership = one item" is the same
 * invariant F4-03 fixed for provider subscriptions.
 */
function resolveSingleItemId(
  subscription: Stripe.Subscription,
): ServiceResult<{ itemId: string; priceId: string }, never> {
  const items = subscription.items.data;
  const item = items[0];

  if (items.length !== 1 || !item) {
    console.error("[corporate-billing] UNEXPECTED_ITEM_COUNT", {
      stripeSubscriptionId: subscription.id,
      itemCount: items.length,
    });

    return svcFail("CONFLICT", "Subscription does not have exactly one item");
  }

  return svcOk({ itemId: item.id, priceId: item.price.id });
}

/**
 * Points the single subscription item at a new Price with
 * `create_prorations`, exactly like `changePlan` (F4-04). A retry — or a
 * webhook that already applied the change — converges without a second round
 * of prorations.
 */
export async function updateCorporateSubscriptionPrice(
  deps: CorporateBillingDeps,
  input: {
    accountId: string;
    stripeSubscriptionId: string;
    targetPriceId: string;
    tier: CorporateTier;
    /** Version of the local account row, used only for the idempotency key. */
    version: number;
  },
): Promise<ServiceResult<{ changed: boolean }, never>> {
  try {
    const subscription = await deps.stripe.subscriptions.retrieve(
      input.stripeSubscriptionId,
    );
    const item = resolveSingleItemId(subscription);

    if (!item.ok) {
      return item;
    }

    if (item.data.priceId === input.targetPriceId) {
      return svcOk({ changed: false });
    }

    await deps.stripe.subscriptions.update(
      input.stripeSubscriptionId,
      {
        items: [{ id: item.data.itemId, price: input.targetPriceId }],
        proration_behavior: "create_prorations",
        metadata: {
          corporateAccountId: input.accountId,
          corporateTier: input.tier,
        },
      },
      {
        idempotencyKey: `corporate-terms-${input.accountId}-${input.version}-${input.targetPriceId}`,
      },
    );

    return svcOk({ changed: true });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] PRICE_UPDATE_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription update failed");
    }

    throw error;
  }
}

/**
 * Pauses collection without cancelling the subscription: `behavior: "void"`
 * stops invoicing entirely while suspended, and the subscription object stays
 * alive so `reactivate` can resume the very same billing anchor.
 */
export async function pauseCorporateSubscription(
  deps: CorporateBillingDeps,
  input: { accountId: string; stripeSubscriptionId: string },
): Promise<ServiceResult<null, never>> {
  try {
    await deps.stripe.subscriptions.update(input.stripeSubscriptionId, {
      pause_collection: { behavior: "void" },
    });

    return svcOk(null);
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] PAUSE_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription pause failed");
    }

    throw error;
  }
}

/**
 * Clears `pause_collection` and returns the fresh remote state so the caller
 * can sync `CorporateMembership.status`/`renewsAt` before reactivating.
 */
export async function resumeCorporateSubscription(
  deps: CorporateBillingDeps,
  input: { accountId: string; stripeSubscriptionId: string },
): Promise<ServiceResult<CorporateSubscriptionSnapshot, never>> {
  try {
    const updated = await deps.stripe.subscriptions.update(
      input.stripeSubscriptionId,
      { pause_collection: "" },
    );

    return svcOk({
      stripeSubscriptionId: updated.id,
      status: mapStripeSubscriptionStatus(updated.status),
      renewsAt: getRenewsAt(updated),
    });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[corporate-billing] RESUME_FAILED", {
        corporateAccountId: input.accountId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription resume failed");
    }

    throw error;
  }
}
