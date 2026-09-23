import "server-only";

import {
  Prisma,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import { getOrCreateForRequest } from "~/server/services/messaging/conversations";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  isRequestVisibleOnRadar,
  resolveRadarBranch,
} from "./radar-visibility";

export type SubmitQuoteResult = {
  quoteId: string;
  conversationId: string;
  /** `true` when an own PENDING quote was edited in place. */
  updated: boolean;
};

export type WithdrawQuoteResult = {
  quoteId: string;
  status: typeof QuoteStatus.WITHDRAWN;
};

/** Request states in which the marketplace still accepts offers. */
export const QUOTABLE_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.OPEN,
  RequestStatus.QUOTED,
];

/** Own quote states that can be (re)sent through quote.submit. */
const RESUBMITTABLE_QUOTE_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING,
  QuoteStatus.WITHDRAWN,
];

class QuoteChangedError extends Error {
  constructor() {
    super("Quote changed concurrently");
    this.name = "QuoteChangedError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Business-side quote submit (M5-W1 / N2, P-WEB-02): validates the request is
 * OPEN or QUOTED and visible on the radar, the worker belongs to the business,
 * then writes the Quote and upserts the pre-order Conversation (MA-08).
 *
 * Request lifecycle: the first active offer moves the request OPEN → QUOTED;
 * it stays QUOTED while at least one PENDING offer exists (see withdrawQuote).
 *
 * Re-quoting: the [requestId, businessId] pair keeps a single row. A PENDING
 * quote is edited in place; a WITHDRAWN one is revived back to PENDING with
 * the new terms. ACCEPTED / REJECTED / EXPIRED rows answer CONFLICT.
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
    message?: string;
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

  if (input.scheduledAt.getTime() <= Date.now()) {
    return svcFail("VALIDATION_ERROR", "Scheduled time must be in the future");
  }

  const request = await db.serviceRequest.findFirst({
    where: {
      id: input.requestId,
      status: { in: QUOTABLE_REQUEST_STATUSES },
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

  const existing = await db.quote.findUnique({
    where: {
      requestId_businessId: {
        requestId: input.requestId,
        businessId: input.businessId,
      },
    },
    select: { id: true, status: true },
  });

  if (existing && !RESUBMITTABLE_QUOTE_STATUSES.includes(existing.status)) {
    return svcFail("CONFLICT", "Quote can no longer be changed");
  }

  const terms = {
    branchId: branch.data.id,
    workerId: input.workerId,
    amountCents: input.priceCents,
    scheduledFor: input.scheduledAt,
    message: input.message ?? null,
    status: QuoteStatus.PENDING,
  };

  let quoteId: string;

  try {
    quoteId = await db.$transaction(async (tx) => {
      let id: string;

      if (existing) {
        const revived = await tx.quote.updateMany({
          where: {
            id: existing.id,
            businessId: input.businessId,
            status: { in: RESUBMITTABLE_QUOTE_STATUSES },
          },
          data: terms,
        });

        if (revived.count === 0) {
          throw new QuoteChangedError();
        }

        id = existing.id;
      } else {
        const created = await tx.quote.create({
          data: {
            requestId: input.requestId,
            businessId: input.businessId,
            ...terms,
          },
          select: { id: true },
        });

        id = created.id;
      }

      await tx.serviceRequest.updateMany({
        where: { id: input.requestId, status: RequestStatus.OPEN },
        data: { status: RequestStatus.QUOTED },
      });

      return id;
    });
  } catch (error) {
    if (isUniqueViolation(error) || error instanceof QuoteChangedError) {
      return svcFail("CONFLICT", "Quote changed concurrently");
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

  const updated = existing?.status === QuoteStatus.PENDING;

  if (!updated) {
    await sendLocalizedPushToUser(db, request.customerId, {
      message: "quoteReceived",
      url: `home360app://request/${request.id}/quotes`,
    });
  }

  return svcOk({
    quoteId,
    conversationId: conversation.data.conversationId,
    updated,
  });
}

/**
 * Withdraws an own PENDING quote → WITHDRAWN. The row stays (a later submit
 * revives it). When it was the last PENDING offer on a QUOTED request, the
 * request returns to OPEN so the radar and the customer see it unquoted.
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

  const withdrawn = await db.$transaction(async (tx) => {
    const changed = await tx.quote.updateMany({
      where: {
        id: quote.id,
        businessId: input.businessId,
        status: QuoteStatus.PENDING,
      },
      data: { status: QuoteStatus.WITHDRAWN },
    });

    if (changed.count === 0) {
      return false;
    }

    const remaining = await tx.quote.count({
      where: { requestId: quote.requestId, status: QuoteStatus.PENDING },
    });

    if (remaining === 0) {
      await tx.serviceRequest.updateMany({
        where: { id: quote.requestId, status: RequestStatus.QUOTED },
        data: { status: RequestStatus.OPEN },
      });
    }

    return true;
  });

  if (!withdrawn) {
    return svcFail("CONFLICT", "Quote is not pending");
  }

  return svcOk({ quoteId: quote.id, status: QuoteStatus.WITHDRAWN });
}
