import "server-only";

import { svcOk } from "~/server/services/service-result";
import { syncCorporateMembershipFromStripe } from "~/server/services/corporate/sync-corporate-membership";
import { upsertCorporateInvoiceFromStripe } from "~/server/services/corporate/upsert-corporate-invoice";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { resolveInvoiceSubscriptionId } from "./invoice-paid";

/**
 * Corporate Billing events (F7-07).
 *
 * These handlers share event types with the business Billing handlers of F4:
 * the dispatcher runs both, and each one recognizes its domain by looking the
 * ids up in its own tables (`CorporateMembership.stripeSubscriptionId`,
 * `CorporateAccount.stripeCustomerId`), never by trusting metadata. An event
 * that belongs to the other domain resolves as a success with no effect.
 */

/**
 * A paid consolidated invoice. After the upsert the subscription is re-read
 * from Stripe — the invoice alone does not carry the new period — so `status`,
 * `renewsAt` and `stripeUpdatedAt` come from the authoritative object.
 */
const handleCorporateInvoicePaid: StripeEventHandler = async (
  { db, stripe },
  event,
) => {
  if (event.type !== "invoice.paid") {
    return svcOk(null);
  }

  const invoice = event.data.object;
  const upserted = await upsertCorporateInvoiceFromStripe(db, invoice);

  if (!upserted.ok) {
    return upserted;
  }

  // Not a corporate invoice: the business handler owns it (or nobody does).
  if (upserted.data.corporateInvoiceId === null) {
    return svcOk(null);
  }

  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return svcOk(null);
  }

  const subscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  );
  const synced = await syncCorporateMembershipFromStripe(
    { db },
    // A fresh retrieve reflects the state at this instant, so the observation
    // timestamp is "now" rather than the (older) invoice event timestamp.
    { subscription, observedAt: new Date() },
  );

  return synced.ok ? svcOk(null) : synced;
};

/**
 * A failed charge leaves the corporate invoice open and the membership in
 * arrears. `PAST_DUE` never overwrites `CANCELED`, and it does not invent an
 * access suspension either: the access policy stays on
 * `CorporateAccount.status`.
 */
const handleCorporateInvoicePaymentFailed: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "invoice.payment_failed") {
    return svcOk(null);
  }

  const invoice = event.data.object;
  const upserted = await upsertCorporateInvoiceFromStripe(db, invoice);

  if (!upserted.ok) {
    return upserted;
  }

  if (upserted.data.corporateInvoiceId === null) {
    return svcOk(null);
  }

  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return svcOk(null);
  }

  await db.corporateMembership.updateMany({
    where: { stripeSubscriptionId, status: { not: "CANCELED" } },
    data: { status: "PAST_DUE" },
  });

  return svcOk(null);
};

/**
 * Plan changes, arrears and pauses all arrive here. The write is absolute and
 * `event.created` guards against out-of-order deliveries; the account status
 * is never touched by a mere update.
 */
const handleCorporateSubscriptionUpdated: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "customer.subscription.updated") {
    return svcOk(null);
  }

  const synced = await syncCorporateMembershipFromStripe(
    { db },
    {
      subscription: event.data.object,
      observedAt: new Date(event.created * 1000),
    },
  );

  return synced.ok ? svcOk(null) : synced;
};

/**
 * Deletion arrives with status `canceled`: the membership becomes `CANCELED`
 * and the account `CANCELLED` in one transaction. `renewsAt` is kept as-is —
 * it documents the period that was paid for.
 */
const handleCorporateSubscriptionDeleted: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "customer.subscription.deleted") {
    return svcOk(null);
  }

  const synced = await syncCorporateMembershipFromStripe(
    { db },
    {
      subscription: event.data.object,
      observedAt: new Date(event.created * 1000),
      cancelAccount: true,
    },
  );

  return synced.ok ? svcOk(null) : synced;
};

/** Corporate Billing events (F7). Business Billing lives in `billingHandlers`. */
export const corporateBillingHandlers: Record<string, StripeEventHandler> = {
  "invoice.paid": handleCorporateInvoicePaid,
  "invoice.payment_failed": handleCorporateInvoicePaymentFailed,
  "customer.subscription.updated": handleCorporateSubscriptionUpdated,
  "customer.subscription.deleted": handleCorporateSubscriptionDeleted,
};
