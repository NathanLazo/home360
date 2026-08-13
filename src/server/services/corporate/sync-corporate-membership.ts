import "server-only";

import type Stripe from "stripe";

import { z } from "zod";

import {
  CorporateStatus,
  CorporateTier,
  SubscriptionStatus,
  type Prisma,
  type PrismaClient,
} from "../../../../generated/prisma";
import { svcOk, type ServiceResult } from "~/server/services/service-result";
import {
  getRenewsAt,
  mapStripeSubscriptionStatus,
} from "~/server/services/subscription/subscription-status";

/**
 * Mirrors a corporate Stripe subscription onto `CorporateMembership` (F7-07).
 *
 * Deliberately parallel to `subscription/sync-subscription.ts`: that service is
 * typed for `Subscription`/`Business` and this one for the corporate models.
 * Both share the same doctrine — Stripe is the source of truth for the billing
 * cycle, writes are absolute, and events for objects this application does not
 * own resolve as a success with no effect.
 */

export type SyncCorporateMembershipDeps = {
  db: PrismaClient;
};

export type SyncCorporateMembershipInput = {
  subscription: Stripe.Subscription;
  /**
   * Stripe-side timestamp of this observation: `event.created` for webhook
   * deliveries, or the retrieval time for a fresh `subscriptions.retrieve`.
   * Older observations than the stored `stripeUpdatedAt` are discarded so an
   * out-of-order delivery can never roll the membership back.
   */
  observedAt: Date;
  /**
   * Only `customer.subscription.deleted` cancels the account itself: a mere
   * status change (including a future `paused`) affects the membership, while
   * the access policy keeps living on `CorporateAccount.status`.
   */
  cancelAccount?: boolean;
};

const identifierSchema = z.string().trim().min(1);

/**
 * Metadata written by `createCorporateBillingSubscription` (F7-03). It only
 * orients the lookup for the crash window between the remote creation and the
 * local persistence; the database always confirms the relationship.
 */
const corporateSubscriptionMetadataSchema = z.object({
  corporateAccountId: identifierSchema.optional(),
  corporateMembershipId: identifierSchema.optional(),
});

const membershipSelect = {
  id: true,
  status: true,
  stripeSubscriptionId: true,
  stripeUpdatedAt: true,
  corporateAccountId: true,
  corporateAccount: {
    select: {
      id: true,
      status: true,
      tier: true,
      stripeCustomerId: true,
    },
  },
} satisfies Prisma.CorporateMembershipSelect;

export type CorporateMembershipForSync = Prisma.CorporateMembershipGetPayload<{
  select: typeof membershipSelect;
}>;

export function resolveStripeCustomerId(
  customer: string | { id: string } | null | undefined,
): string | null {
  if (typeof customer === "string") {
    return customer.trim().length > 0 ? customer : null;
  }

  return customer?.id ?? null;
}

/**
 * Locates the corporate membership a Stripe subscription belongs to.
 *
 * Never authorized by metadata alone. The order is fixed by the ticket:
 *
 * 1. `CorporateMembership.stripeSubscriptionId`.
 * 2. `CorporateAccount.stripeCustomerId`.
 * 3. Metadata ids, followed by a query that proves both ids are related and
 *    that the Stripe customer matches — this only repairs the crash between
 *    the remote creation and the local persistence.
 */
export async function findCorporateMembershipForSubscription(
  db: PrismaClient,
  input: {
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    metadata: unknown;
  },
): Promise<CorporateMembershipForSync | null> {
  if (input.stripeSubscriptionId !== null) {
    const bySubscription = await db.corporateMembership.findUnique({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
      select: membershipSelect,
    });

    if (bySubscription) {
      return bySubscription;
    }
  }

  if (input.stripeCustomerId !== null) {
    const byCustomer = await db.corporateMembership.findFirst({
      where: {
        corporateAccount: { stripeCustomerId: input.stripeCustomerId },
      },
      select: membershipSelect,
    });

    if (byCustomer) {
      return byCustomer;
    }
  }

  const metadata = corporateSubscriptionMetadataSchema.safeParse(
    input.metadata,
  );

  if (
    !metadata.success ||
    metadata.data.corporateMembershipId === undefined ||
    metadata.data.corporateAccountId === undefined ||
    input.stripeCustomerId === null
  ) {
    return null;
  }

  // Metadata orients the search; the database confirms the ownership: the
  // membership must belong to the claimed account AND that account must own
  // the Stripe customer of the event.
  return db.corporateMembership.findFirst({
    where: {
      id: metadata.data.corporateMembershipId,
      corporateAccountId: metadata.data.corporateAccountId,
      corporateAccount: { stripeCustomerId: input.stripeCustomerId },
    },
    select: membershipSelect,
  });
}

/**
 * Checks that the single subscription item bills the expected Price: the
 * shared catalog Price of the account's tier, or a per-account Price (CUSTOM
 * and admin-overridden fees carry `corporateAccountId` metadata, F7-03). A
 * discrepancy is logged for triage and never auto-assigns terms — the
 * membership sync still applies because Stripe remains the billing truth.
 */
async function verifySubscriptionPrice(
  db: PrismaClient,
  subscription: Stripe.Subscription,
  account: CorporateMembershipForSync["corporateAccount"],
): Promise<void> {
  const items = subscription.items.data;
  const item = items[0];

  if (items.length !== 1 || !item) {
    console.warn("[corporate-billing] UNEXPECTED_ITEM_COUNT", {
      corporateAccountId: account.id,
      stripeSubscriptionId: subscription.id,
      itemCount: items.length,
    });

    return;
  }

  if (item.price.metadata.corporateAccountId === account.id) {
    return;
  }

  if (account.tier !== CorporateTier.CUSTOM) {
    const config = await db.corporateTierConfig.findUnique({
      where: { tier: account.tier },
      select: { stripePriceId: true },
    });

    if (config?.stripePriceId === item.price.id) {
      return;
    }
  }

  console.warn("[corporate-billing] PRICE_MISMATCH", {
    corporateAccountId: account.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    tier: account.tier,
  });
}

/**
 * Absolute, idempotent write of the remote subscription state.
 *
 * Guards, in order: out-of-order deliveries (`observedAt` vs the stored
 * `stripeUpdatedAt`), a different remote subscription claiming the same
 * membership, and stale events trying to resurrect a `CANCELED` membership or
 * a `CANCELLED` account. `pause_collection` never reaches this mapping — a
 * paused-collection subscription keeps its Stripe status and the visible
 * suspension state comes from `CorporateAccount.status`, not from a fake
 * translation.
 */
export async function syncCorporateMembershipFromStripe(
  deps: SyncCorporateMembershipDeps,
  input: SyncCorporateMembershipInput,
): Promise<ServiceResult<{ membershipId: string | null }>> {
  const { subscription, observedAt } = input;
  const membership = await findCorporateMembershipForSubscription(deps.db, {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: resolveStripeCustomerId(subscription.customer),
    metadata: subscription.metadata,
  });

  // Business Billing or foreign tenant subscription: nothing corporate to do.
  if (!membership) {
    return svcOk({ membershipId: null });
  }

  // Out-of-order delivery: something strictly newer was already applied.
  // Duplicates with the same timestamp re-apply the same absolute write.
  if (
    membership.stripeUpdatedAt !== null &&
    observedAt.getTime() < membership.stripeUpdatedAt.getTime()
  ) {
    console.warn("[corporate-billing] IGNORED_STALE_EVENT", {
      corporateMembershipId: membership.id,
      stripeSubscriptionId: subscription.id,
      observedAt: observedAt.toISOString(),
      stripeUpdatedAt: membership.stripeUpdatedAt.toISOString(),
    });

    return svcOk({ membershipId: membership.id });
  }

  // The membership is already bound to a different remote subscription: this
  // event belongs to an object this row does not own. Log and stand down —
  // overwriting would silently rebind the billing cycle.
  if (
    membership.stripeSubscriptionId !== null &&
    membership.stripeSubscriptionId !== subscription.id
  ) {
    console.warn("[corporate-billing] FOREIGN_SUBSCRIPTION_EVENT", {
      corporateMembershipId: membership.id,
      boundSubscriptionId: membership.stripeSubscriptionId,
      eventSubscriptionId: subscription.id,
    });

    return svcOk({ membershipId: membership.id });
  }

  const status = mapStripeSubscriptionStatus(subscription.status);

  // A late event must never resurrect a canceled membership or account.
  if (
    (membership.status === SubscriptionStatus.CANCELED ||
      membership.corporateAccount.status === CorporateStatus.CANCELLED) &&
    status !== SubscriptionStatus.CANCELED
  ) {
    console.warn("[corporate-billing] IGNORED_REACTIVATION_EVENT", {
      corporateMembershipId: membership.id,
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
    });

    return svcOk({ membershipId: membership.id });
  }

  await verifySubscriptionPrice(
    deps.db,
    subscription,
    membership.corporateAccount,
  );

  const renewsAt = getRenewsAt(subscription);
  const membershipData = {
    stripeSubscriptionId: subscription.id,
    status,
    ...(renewsAt ? { renewsAt } : {}),
    stripeUpdatedAt: observedAt,
  };

  if (input.cancelAccount === true && status === SubscriptionStatus.CANCELED) {
    // `customer.subscription.deleted`: membership and account fall together,
    // atomically, so access policy and billing state can never disagree.
    await deps.db.$transaction(async (tx) => {
      await tx.corporateMembership.update({
        where: { id: membership.id },
        data: membershipData,
      });
      await tx.corporateAccount.updateMany({
        where: {
          id: membership.corporateAccountId,
          status: { not: CorporateStatus.CANCELLED },
        },
        data: {
          status: CorporateStatus.CANCELLED,
          statusReason: "Stripe subscription canceled",
        },
      });
    });

    return svcOk({ membershipId: membership.id });
  }

  await deps.db.corporateMembership.update({
    where: { id: membership.id },
    data: membershipData,
  });

  return svcOk({ membershipId: membership.id });
}
