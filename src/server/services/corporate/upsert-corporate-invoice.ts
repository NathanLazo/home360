import "server-only";

import type Stripe from "stripe";

import type { InvoiceStatus, PrismaClient } from "../../../../generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "~/server/services/service-result";
import { resolveInvoiceSubscriptionId } from "~/server/services/stripe/handlers/invoice-paid";
import {
  findCorporateMembershipForSubscription,
  resolveStripeCustomerId,
  type CorporateMembershipForSync,
} from "./sync-corporate-membership";

/**
 * Consolidated corporate invoices (F7-07).
 *
 * One subscription/customer covers every location of the account: this is the
 * "unified billing" `spec/09` defines, so exactly one `CorporateInvoice` row
 * exists per Stripe invoice — never one per location.
 */

export type CorporateInvoiceSyncResult = {
  corporateInvoiceId: string | null;
};

/**
 * Maps the Stripe invoice status onto the local enum. The switch has no
 * `default`: every documented status is handled explicitly, and the fallback
 * after it only covers `OtherString` — the forward-compatibility widening the
 * SDK adds so a status Stripe ships tomorrow does not throw today.
 */
export function mapStripeInvoiceStatus(
  status: Stripe.Invoice.Status,
): InvoiceStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "open":
    case "draft":
    case "uncollectible":
      return "OPEN";
    case "void":
      return "VOID";
  }

  console.error("[corporate-billing] UNKNOWN_INVOICE_STATUS", { status });

  return "OPEN";
}

async function resolveMembershipForInvoice(
  db: PrismaClient,
  invoice: Stripe.Invoice,
): Promise<CorporateMembershipForSync | null> {
  return findCorporateMembershipForSubscription(db, {
    stripeSubscriptionId: resolveInvoiceSubscriptionId(invoice),
    stripeCustomerId: resolveStripeCustomerId(invoice.customer),
    // Immutable snapshot of the subscription metadata at finalization; it only
    // orients the lookup, the query proves ownership against the customer id.
    metadata: invoice.parent?.subscription_details?.metadata ?? null,
  });
}

/**
 * Writes a corporate invoice from its Stripe payload.
 *
 * `stripeInvoiceId` is unique, so a duplicate delivery updates the same row
 * and never creates a second one. `PAID` is terminal: a late `payment_failed`
 * can never take revenue back off a paid invoice. Billing events that belong
 * to business plans — or to nobody — resolve as a success with no write so
 * the webhook answers 200.
 */
export async function upsertCorporateInvoiceFromStripe(
  db: PrismaClient,
  invoice: Stripe.Invoice,
): Promise<ServiceResult<CorporateInvoiceSyncResult>> {
  const stripeInvoiceId = invoice.id;

  if (!stripeInvoiceId || invoice.status === null) {
    return svcOk({ corporateInvoiceId: null });
  }

  const membership = await resolveMembershipForInvoice(db, invoice);

  if (!membership) {
    return svcOk({ corporateInvoiceId: null });
  }

  if (invoice.currency !== "mxn") {
    console.error("[corporate-billing] UNEXPECTED_INVOICE_CURRENCY", {
      stripeInvoiceId,
      currency: invoice.currency,
    });

    return svcFail("CONFLICT", "Corporate invoice is not in MXN");
  }

  const status = mapStripeInvoiceStatus(invoice.status);
  // Always an integer amount in cents: what was actually collected for a paid
  // invoice, what is owed for an open one.
  const amountCents =
    status === "PAID" ? invoice.amount_paid : invoice.amount_due;
  const pdfUrl = invoice.invoice_pdf ?? null;

  const existing = await db.corporateInvoice.findUnique({
    where: { stripeInvoiceId },
    select: { id: true, corporateAccountId: true },
  });

  // The stored account must match the membership's account: a mismatch means
  // the invoice was re-attributed remotely and must be triaged, not silently
  // rewritten onto another tenant.
  if (existing && existing.corporateAccountId !== membership.corporateAccountId) {
    console.error("[corporate-billing] INVOICE_ACCOUNT_MISMATCH", {
      stripeInvoiceId,
      storedAccountId: existing.corporateAccountId,
      membershipAccountId: membership.corporateAccountId,
    });

    return svcFail("CONFLICT", "Corporate invoice belongs to another account");
  }

  const row = await db.corporateInvoice.upsert({
    where: { stripeInvoiceId },
    create: {
      corporateAccountId: membership.corporateAccountId,
      corporateMembershipId: membership.id,
      stripeInvoiceId,
      amountCents,
      status,
      pdfUrl,
      issuedAt: new Date(invoice.created * 1000),
    },
    // Absolute, never accumulated. Status is written below with the terminal
    // `PAID` guard.
    update: { amountCents, pdfUrl },
    select: { id: true },
  });

  if (status === "PAID") {
    await db.corporateInvoice.update({
      where: { stripeInvoiceId },
      data: { status },
    });
  } else {
    await db.corporateInvoice.updateMany({
      where: { stripeInvoiceId, status: { not: "PAID" } },
      data: { status },
    });
  }

  return svcOk({ corporateInvoiceId: row.id });
}
