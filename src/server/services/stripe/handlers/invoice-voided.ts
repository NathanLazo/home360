import "server-only";

import { svcOk } from "~/server/services/service-result";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { upsertInvoiceFromStripe } from "./invoice-paid";

/**
 * Voiding cancels an unpaid invoice. `upsertInvoiceFromStripe` refuses to move
 * a row that is already `PAID`, so a late event cannot reverse recognised
 * revenue.
 */
export const handleInvoiceVoided: StripeEventHandler = async (
  { db },
  event,
) => {
  if (event.type !== "invoice.voided") {
    return svcOk(null);
  }

  return upsertInvoiceFromStripe(db, event.data.object, "VOID");
};
