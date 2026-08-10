import "server-only";

import { svcOk } from "~/server/services/service-result";
import type { StripeEventHandler } from "../webhook-dispatcher";

export const handleAccountUpdated: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "account.updated") {
    return svcOk(null);
  }

  const account = event.data.object;
  const business = await db.business.findUnique({
    where: { stripeAccountId: account.id },
    select: { id: true },
  });

  // Connect accounts this application does not know about are ignored.
  if (business === null) {
    return svcOk(null);
  }

  // Absolute write: replaying the event yields the same capabilities.
  await db.business.updateMany({
    where: { id: business.id, stripeAccountId: account.id },
    data: {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    },
  });

  return svcOk(null);
};
