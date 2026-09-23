import "server-only";

import {
  Prisma,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
  type Quote,
} from "@generated/prisma";
import { getOrCreateForRequest } from "~/server/services/messaging/conversations";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  isRequestVisibleOnRadar,
  QUOTABLE_REQUEST_STATUSES,
  resolveRadarBranch,
} from "./radar-visibility";
import { reopenRequestIfUnquoted } from "./request-quote-status";

export type SubmitQuoteResult = {
  quoteId: string;
  conversationId: string;
};

export type WithdrawQuoteResult = {
  quoteId: string;
  status: typeof QuoteStatus.WITHDRAWN;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Thrown inside the submit transaction to roll it back with a stable code. */
class RequestNoLongerQuotableError extends Error {}

/**
 * Business-side quote submit (M5-W1 / N2): validates the request is quotable
 * (OPEN or QUOTED) and visible on the radar, the worker belongs to the
 * business, then — in one transaction — moves the request OPEN → QUOTED
 * (P-WEB-02; a QUOTED request stays QUOTED) and creates the PENDING Quote.
 * The request row update runs first so it doubles as the row lock that
 * serializes submit against `withdrawQuote` and `acceptQuote`. Afterwards it
 * upserts the pre-order Conversation (MA-08). A second submit for the same
 * [requestId, businessId] surfaces CONFLICT (P2002), including after
 * WITHDRAWN — re-quoting is deliberately blocked (MA-16).
 */
export async function submitQuote(
  db: PrismaClient,
  input: {
    businessId: string;
    userId: string;
    requestId: string;
    priceCents: number;
    scheduledAt: Date;
    workerId: string;
    branchId?: string;
  },
): Promise<ServiceResult<SubmitQuoteResult, "VALIDATION_ERROR">> {
  const worker = await db.worker.findFirst({
    where: { id: input.workerId },
    select: { id: true, businessId: true },
  });

  if (!worker) {
    return svcFail("NOT_FOUND", "Worker not found");
  }

  if (worker.businessId !== input.businessId) {
    return svcFail("VALIDATION_ERROR", "Worker does not belong to business");
  }

  const request = await db.serviceRequest.findFirst({
    where: {
      id: input.requestId,
      status: { in: [...QUOTABLE_REQUEST_STATUSES] },
    },
    select: { id: true, customerId: true },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const visible = await isRequestVisibleOnRadar(db, {
    businessId: input.businessId,
    requestId: input.requestId,
  });

  if (!visible) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const branch = await resolveRadarBranch(db, {
    businessId: input.businessId,
    branchId: input.branchId,
  });

  if (!branch.ok) {
    return branch;
  }

  let quote: Pick<Quote, "id">;

  try {
    quote = await db.$transaction(async (tx) => {
      // Conditional transition: only a still-quotable request moves to (or
      // stays in) QUOTED. A request accepted or cancelled since the read
      // above matches zero rows and the whole submit rolls back.
      const marked = await tx.serviceRequest.updateMany({
        where: {
          id: input.requestId,
          status: { in: [...QUOTABLE_REQUEST_STATUSES] },
        },
        data: { status: RequestStatus.QUOTED },
      });

      if (marked.count === 0) {
        throw new RequestNoLongerQuotableError();
      }

      return tx.quote.create({
        data: {
          requestId: input.requestId,
          businessId: input.businessId,
          branchId: branch.data.id,
          workerId: input.workerId,
          amountCents: input.priceCents,
          scheduledFor: input.scheduledAt,
          status: QuoteStatus.PENDING,
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (error instanceof RequestNoLongerQuotableError) {
      return svcFail("NOT_FOUND", "Request not found");
    }

    if (isUniqueViolation(error)) {
      return svcFail("CONFLICT", "Quote already exists for this request");
    }

    throw error;
  }

  // Quote must exist before getOrCreateForRequest (M4 findings).
  const conversation = await getOrCreateForRequest(db, {
    userId: input.userId,
    role: "BUSINESS",
    requestId: input.requestId,
  });

  if (!conversation.ok) {
    return svcFail("NOT_FOUND", "Conversation could not be opened");
  }

  await sendLocalizedPushToUser(db, request.customerId, {
    message: "quoteReceived",
    url: `home360app://request/${request.id}/quotes`,
  });

  return svcOk({
    quoteId: quote.id,
    conversationId: conversation.data.conversationId,
  });
}

/**
 * Withdraws an own PENDING quote → WITHDRAWN. The row stays so
 * @@unique([requestId, businessId]) blocks a second submit (MA-16).
 *
 * P-WEB-02: in the same transaction, when no PENDING offer remains on the
 * request, a QUOTED request goes back to OPEN (it was never accepted, so it
 * returns to the radar of every other business). Any other request status
 * (ACCEPTED, CANCELLED, EXPIRED) is left untouched.
 */
export async function withdrawQuote(
  db: PrismaClient,
  input: { businessId: string; quoteId: string },
): Promise<ServiceResult<WithdrawQuoteResult>> {
  const quote = await db.quote.findFirst({
    where: { id: input.quoteId, businessId: input.businessId },
    select: { id: true, status: true, requestId: true },
  });

  if (!quote) {
    return svcFail("NOT_FOUND", "Quote not found");
  }

  if (quote.status !== QuoteStatus.PENDING) {
    return svcFail("CONFLICT", "Quote is not pending");
  }

  return db.$transaction(async (tx) => {
    const withdrawn = await tx.quote.updateMany({
      where: {
        id: quote.id,
        businessId: input.businessId,
        status: QuoteStatus.PENDING,
      },
      data: { status: QuoteStatus.WITHDRAWN },
    });

    if (withdrawn.count === 0) {
      return svcFail("CONFLICT", "Quote is not pending");
    }

    await reopenRequestIfUnquoted(tx, quote.requestId);

    return svcOk({ quoteId: quote.id, status: QuoteStatus.WITHDRAWN });
  });
}
