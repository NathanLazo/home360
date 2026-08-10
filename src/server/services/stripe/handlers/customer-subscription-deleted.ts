import "server-only";

import { svcOk } from "~/server/services/service-result";
import { syncSubscriptionFromStripe } from "~/server/services/subscription/sync-subscription";
import type { StripeEventHandler } from "../webhook-dispatcher";

/**
 * Deletion arrives with status `canceled`, which maps to the local `CANCELED`
 * and degrades the dashboard to read-only (F4-07). `renewsAt` is kept as-is:
 * it documents the period that was paid for.
 */
export const handleCustomerSubscriptionDeleted: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "customer.subscription.deleted") {
    return svcOk(null);
  }

  const synced = await syncSubscriptionFromStripe({ db }, event.data.object);

  return synced.ok ? svcOk(null) : synced;
};
