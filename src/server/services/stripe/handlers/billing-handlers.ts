import "server-only";

import type { StripeEventHandler } from "../webhook-dispatcher";
import { handleCustomerSubscriptionDeleted } from "./customer-subscription-deleted";
import { handleCustomerSubscriptionUpdated } from "./customer-subscription-updated";
import { handleInvoiceFinalized } from "./invoice-finalized";
import { handleInvoicePaid } from "./invoice-paid";
import { handleInvoicePaymentFailed } from "./invoice-payment-failed";
import { handleInvoiceVoided } from "./invoice-voided";

/** Billing events (F4). Escrow and Connect events live in the F3 registration. */
export const billingHandlers: Record<string, StripeEventHandler> = {
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "invoice.finalized": handleInvoiceFinalized,
  "invoice.voided": handleInvoiceVoided,
  "customer.subscription.updated": handleCustomerSubscriptionUpdated,
  "customer.subscription.deleted": handleCustomerSubscriptionDeleted,
};
