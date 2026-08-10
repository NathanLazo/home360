import "server-only";

import type Stripe from "stripe";

import type { PrismaClient } from "../../../../generated/prisma";
import { svcOk, type ServiceResult } from "~/server/services/service-result";
import {
  getRenewsAt,
  mapStripeSubscriptionStatus,
} from "./subscription-status";

export type SyncSubscriptionDeps = {
  db: PrismaClient;
};

/**
 * Mirrors a Stripe subscription onto the local row.
 *
 * Stripe is the source of truth for the billing cycle, so the write is absolute
 * and replaying an event converges instead of accumulating. Events for objects
 * this application does not own are a success with no effect: the same webhook
 * endpoint also receives escrow PaymentIntents.
 */
export async function syncSubscriptionFromStripe(
  deps: SyncSubscriptionDeps,
  stripeSubscription: Stripe.Subscription,
): Promise<ServiceResult<{ subscriptionId: string | null }>> {
  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  const local = await deps.db.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: stripeSubscription.id },
        { business: { stripeCustomerId: customerId } },
      ],
    },
    select: { id: true, status: true, stripeSubscriptionId: true },
  });

  if (!local) {
    return svcOk({ subscriptionId: null });
  }

  // A stale event must never revive a subscription already canceled for the
  // same remote id. Reactivation, if it is ever adopted, has to bind a new
  // cycle explicitly instead of being inferred from an out-of-order delivery.
  const isSameRemote = local.stripeSubscriptionId === stripeSubscription.id;
  const status = mapStripeSubscriptionStatus(stripeSubscription.status);

  if (isSameRemote && local.status === "CANCELED" && status !== "CANCELED") {
    console.warn("[billing] IGNORED_REACTIVATION_EVENT", {
      subscriptionId: local.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeStatus: stripeSubscription.status,
    });

    return svcOk({ subscriptionId: local.id });
  }

  // Scheduled cancellation has no local column yet (F3-F4-findings #20); it is
  // logged rather than silently dropped.
  if (stripeSubscription.cancel_at_period_end) {
    console.warn("[billing] CANCEL_AT_PERIOD_END_NOT_PERSISTED", {
      subscriptionId: local.id,
      cancelAt: stripeSubscription.cancel_at,
    });
  }

  const priceId = stripeSubscription.items.data[0]?.price.id;
  const plan = priceId
    ? await deps.db.plan.findUnique({
        where: { stripePriceId: priceId },
        select: { id: true },
      })
    : null;

  if (priceId && !plan) {
    // A rotated Price (F4-01) no longer maps to any plan: keep the local plan
    // rather than guessing which product the business is on.
    console.warn("[billing] UNMAPPED_STRIPE_PRICE", {
      subscriptionId: local.id,
      priceId,
    });
  }

  const renewsAt = getRenewsAt(stripeSubscription);

  await deps.db.subscription.update({
    where: { id: local.id },
    data: {
      stripeSubscriptionId: stripeSubscription.id,
      status,
      ...(renewsAt ? { renewsAt } : {}),
      ...(plan ? { planId: plan.id } : {}),
    },
  });

  return svcOk({ subscriptionId: local.id });
}
