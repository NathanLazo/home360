import "server-only";

import { svcOk } from "~/server/services/service-result";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { upsertInvoiceFromStripe } from "./invoice-paid";

/**
 * Finalisation is the first moment an invoice has a PDF, so W7 can list and
 * download it before it is paid.
 */
export const handleInvoiceFinalized: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "invoice.finalized") {
    return svcOk(null);
  }

  return upsertInvoiceFromStripe(db, event.data.object, "OPEN");
};
