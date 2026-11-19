import type { SubscriptionStatus } from "@generated/prisma";

export type PlanSelectionInput = {
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  paidInvoiceCount: number;
} | null;

/**
 * Whether the business still has to pick and pay a plan through Checkout
 * (`PENDIENTES.md` §8, revised 2026-11-19). Pure and DB-only, so the layout
 * banner and the W7 page agree without calling Stripe:
 *
 * - no local subscription: approved but never subscribed;
 * - no remote subscription or `CANCELED`: nothing bills the business;
 * - `PAST_DUE` without a single paid invoice: the legacy `default_incomplete`
 *   alta that never got its first payment. A Checkout subscription only exists
 *   once its first invoice is paid, so it never lands here.
 */
export function requiresPlanSelection(
  subscription: PlanSelectionInput,
): boolean {
  if (subscription === null) {
    return true;
  }

  if (
    subscription.stripeSubscriptionId === null ||
    subscription.status === "CANCELED"
  ) {
    return true;
  }

  return (
    subscription.status === "PAST_DUE" && subscription.paidInvoiceCount === 0
  );
}
