import "server-only";

import { svcOk } from "~/server/services/service-result";
import type { StripeEventHandler } from "../webhook-dispatcher";
import {
  resolveInvoiceSubscriptionId,
  upsertInvoiceFromStripe,
} from "./invoice-paid";

/**
 * A failed charge leaves the invoice open and the subscription in arrears.
 *
 * `PAST_DUE` never overwrites `CANCELED`: a dead subscription does not go back
 * to merely owing money because of a late retry event.
 */
export const handleInvoicePaymentFailed: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "invoice.payment_failed") {
    return svcOk(null);
  }

  const invoice = event.data.object;
  const upserted = await upsertInvoiceFromStripe(db, invoice, "OPEN");

  if (!upserted.ok) {
    return upserted;
  }

  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return svcOk(null);
  }

  await db.subscription.updateMany({
    where: { stripeSubscriptionId, status: { not: "CANCELED" } },
    data: { status: "PAST_DUE" },
  });

  return svcOk(null);
};
