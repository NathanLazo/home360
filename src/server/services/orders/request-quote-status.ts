import "server-only";

import {
  Prisma,
  QuoteStatus,
  RequestStatus,
} from "@generated/prisma";

/**
 * P-WEB-02 — `ServiceRequest` status while it collects offers:
 *
 * - OPEN   → no PENDING quote yet.
 * - QUOTED → at least one PENDING quote (set by `submitQuote`).
 * - When the last PENDING quote is withdrawn, a QUOTED request goes back to
 *   OPEN: it was never accepted, so it stays on the radar of every business
 *   that has not quoted it (the withdrawing business cannot re-quote, MA-16).
 *
 * Must run inside the caller's transaction, AFTER the quote row was updated:
 * the quote-then-request lock order matches `acceptQuote`, so the two never
 * deadlock. The `FOR UPDATE` on the request row serializes this check with a
 * concurrent `submitQuote`, whose conditional request update takes the same
 * row lock before inserting its quote.
 */
export async function reopenRequestIfUnquoted(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE
  `);

  const pending = await tx.quote.count({
    where: { requestId, status: QuoteStatus.PENDING },
  });

  if (pending > 0) {
    return;
  }

  await tx.serviceRequest.updateMany({
    where: { id: requestId, status: RequestStatus.QUOTED },
    data: { status: RequestStatus.OPEN },
  });
}
