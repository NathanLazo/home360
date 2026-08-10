import "server-only";

import { svcOk } from "~/server/services/service-result";
import { syncSubscriptionFromStripe } from "~/server/services/subscription/sync-subscription";
import type { StripeEventHandler } from "../webhook-dispatcher";

/**
 * Plan changes, arrears and Customer Portal edits all arrive here. The write is
 * absolute, so it converges with whatever `changePlan` already persisted.
 */
export const handleCustomerSubscriptionUpdated: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "customer.subscription.updated") {
    return svcOk(null);
  }

  const synced = await syncSubscriptionFromStripe({ db }, event.data.object);

  return synced.ok ? svcOk(null) : synced;
};
