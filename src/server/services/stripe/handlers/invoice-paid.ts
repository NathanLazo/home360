import "server-only";

import type Stripe from "stripe";

import type { InvoiceStatus, PrismaClient } from "../../../../../generated/prisma";
import { svcOk, type ServiceResult } from "~/server/services/service-result";
import { syncSubscriptionFromStripe } from "~/server/services/subscription/sync-subscription";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { handlerFail } from "./shared";

/**
 * The subscription id moved inside the invoice payload between Stripe API
 * versions (`invoice.subscription` → `invoice.parent.subscription_details`).
 * This is the single place to touch if Roger changes `apiVersion`.
 */
export function resolveInvoiceSubscriptionId(
  invoice: Stripe.Invoice,
): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (typeof subscription === "string") {
    return subscription;
  }

  return subscription?.id ?? null;
}

function resolveCustomerId(invoice: Stripe.Invoice): string | null {
  if (typeof invoice.customer === "string") {
    return invoice.customer;
  }

  return invoice.customer?.id ?? null;
}

/**
 * Locates the local subscription an invoice belongs to: first by the remote
 * subscription id, then by the Billing customer of the business.
 */
async function resolveLocalSubscriptionId(
  db: PrismaClient,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);
  const customerId = resolveCustomerId(invoice);

  if (!stripeSubscriptionId && !customerId) {
    return null;
  }

  const local = await db.subscription.findFirst({
    where: {
      OR: [
        ...(stripeSubscriptionId ? [{ stripeSubscriptionId }] : []),
        ...(customerId
          ? [{ business: { stripeCustomerId: customerId } }]
          : []),
      ],
    },
    select: { id: true },
  });

  return local?.id ?? null;
}

/**
 * Writes an invoice from its Stripe payload.
 *
 * `stripeInvoiceId` is unique, so a duplicate delivery updates the same row and
 * never creates a second one. `PAID` is terminal: a late `payment_failed` or
 * `voided` can never take revenue back off a paid invoice.
 */
export async function upsertInvoiceFromStripe(
  db: PrismaClient,
  invoice: Stripe.Invoice,
  status: InvoiceStatus,
): Promise<ServiceResult<null>> {
  const stripeInvoiceId = invoice.id;

  if (!stripeInvoiceId) {
    return svcOk(null);
  }

  if (invoice.currency !== "mxn") {
    console.error("[billing] UNEXPECTED_INVOICE_CURRENCY", {
      stripeInvoiceId,
      currency: invoice.currency,
    });

    return handlerFail("CONFLICT", "Invoice is not in MXN");
  }

  const subscriptionId = await resolveLocalSubscriptionId(db, invoice);

  // Billing events of another platform tenant, or of a business approved before
  // F4: nothing to write, and no orphan invoice is invented.
  if (!subscriptionId) {
    return svcOk(null);
  }

  const amountCents =
    status === "PAID" ? invoice.amount_paid : invoice.amount_due;
  const pdfUrl = invoice.invoice_pdf ?? null;

  await db.invoice.upsert({
    where: { stripeInvoiceId },
    create: {
      subscriptionId,
      stripeInvoiceId,
      amountCents,
      status,
      pdfUrl,
      issuedAt: new Date(invoice.created * 1000),
    },
    // Absolute, never accumulated.
    update: { amountCents, pdfUrl },
  });

  if (status === "PAID") {
    await db.invoice.update({ where: { stripeInvoiceId }, data: { status } });
  } else {
    await db.invoice.updateMany({
      where: { stripeInvoiceId, status: { not: "PAID" } },
      data: { status },
    });
  }

  return svcOk(null);
}

export const handleInvoicePaid: StripeEventHandler = async (
  { db, stripe },
  event,
) => {
  if (event.type !== "invoice.paid") {
    return svcOk(null);
  }

  const invoice = event.data.object;
  const upserted = await upsertInvoiceFromStripe(db, invoice, "PAID");

  if (!upserted.ok) {
    return upserted;
  }

  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return svcOk(null);
  }

  // The invoice alone does not carry the new period: read the subscription so
  // `status` and `renewsAt` come from the authoritative object.
  const subscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  );
  const synced = await syncSubscriptionFromStripe({ db }, subscription);

  return synced.ok ? svcOk(null) : synced;
};
