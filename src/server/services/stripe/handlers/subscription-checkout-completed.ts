import "server-only";

import { svcOk } from "~/server/services/service-result";
import { bindCheckoutSubscription } from "~/server/services/subscription/subscription-checkout";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { upsertInvoiceFromStripe } from "./invoice-paid";
import { expandableId } from "./shared";

/**
 * A business finished the plan Checkout (`PENDIENTES.md` §8): bind the new
 * Stripe subscription to its local row. Payment-mode sessions (payment links,
 * token packs) are handled by `handleCheckoutSessionCompleted`.
 *
 * The first `invoice.paid` may arrive before the local row exists and be
 * skipped, so the session's own invoice is recorded here once the row is
 * bound. `stripeInvoiceId` is unique, so both paths converge.
 */
export const handleSubscriptionCheckoutCompleted: StripeEventHandler = async (
  deps,
  event,
) => {
  if (event.type !== "checkout.session.completed") {
    return svcOk(null);
  }

  const session = event.data.object;
  const bound = await bindCheckoutSubscription(deps, session);

  if (!bound.ok) {
    return bound;
  }

  const invoiceId = expandableId(session.invoice);

  if (bound.data.subscriptionId === null || invoiceId === null) {
    return svcOk(null);
  }

  const invoice = await deps.stripe.invoices.retrieve(invoiceId);

  if (invoice.status !== "paid") {
    return svcOk(null);
  }

  return upsertInvoiceFromStripe(deps.db, invoice, "PAID");
};
