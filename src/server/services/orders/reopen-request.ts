import "server-only";

import { QuoteStatus, RequestStatus, type Prisma } from "@generated/prisma";

type ReopenDb = Pick<
  Prisma.TransactionClient,
  "order" | "quote" | "serviceRequest"
>;

export type ReopenedRequest = {
  requestId: string | null;
  requestStatus: RequestStatus | null;
};

/**
 * D10-9: what every cancellation of a SERVICE order does to its marketplace
 * request, whoever cancels (customer, business or the expiry cron). The
 * order's own quote becomes EXPIRED (it stays linked to the cancelled order);
 * the sibling quotes that the accept / capture expired — and that never
 * produced an order of their own — go back to PENDING so
 * the request reopens as QUOTED (or OPEN without siblings), unless the
 * request itself already expired. PRODUCT orders have no quote: no-op.
 *
 * Runs inside the caller's transaction, after the order was claimed.
 */
export async function reopenRequestAfterCancel(
  tx: ReopenDb,
  input: { orderId: string; now?: Date },
): Promise<ReopenedRequest> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: {
      quote: {
        select: {
          id: true,
          requestId: true,
          request: { select: { expiresAt: true } },
        },
      },
    },
  });
  const quote = order?.quote ?? null;

  if (!quote) {
    return { requestId: null, requestStatus: null };
  }

  const now = input.now ?? new Date();

  await tx.quote.update({
    where: { id: quote.id },
    data: { status: QuoteStatus.EXPIRED },
  });

  const requestExpired =
    quote.request.expiresAt !== null &&
    quote.request.expiresAt.getTime() <= now.getTime();
  const restored = requestExpired
    ? { count: 0 }
    : await tx.quote.updateMany({
        where: {
          requestId: quote.requestId,
          id: { not: quote.id },
          status: QuoteStatus.EXPIRED,
          // F10 review M1: a quote already tied to an earlier (cancelled)
          // order can never be accepted again (`Order.quoteId @unique`).
          order: { is: null },
        },
        data: { status: QuoteStatus.PENDING },
      });
  const requestStatus = requestExpired
    ? RequestStatus.EXPIRED
    : restored.count > 0
      ? RequestStatus.QUOTED
      : RequestStatus.OPEN;

  if (requestExpired) {
    await tx.quote.updateMany({
      where: { requestId: quote.requestId, status: QuoteStatus.PENDING },
      data: { status: QuoteStatus.EXPIRED },
    });
  }

  await tx.serviceRequest.update({
    where: { id: quote.requestId },
    data: { status: requestStatus },
  });

  return { requestId: quote.requestId, requestStatus };
}
