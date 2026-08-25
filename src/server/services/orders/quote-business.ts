import "server-only";

import {
  Prisma,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
  type Quote,
} from "../../../../generated/prisma";
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

/**
 * Business-side quote submit (M5-W1 / N2): validates the request is OPEN and
 * visible on the radar, the worker belongs to the business, then creates a
 * PENDING Quote and upserts the pre-order Conversation (MA-08). A second
 * submit for the same [requestId, businessId] surfaces CONFLICT (P2002),
 * including after WITHDRAWN — re-quoting is deliberately blocked (MA-16).
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
    where: { id: input.requestId, status: RequestStatus.OPEN },
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
    quote = await db.quote.create({
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
  } catch (error) {
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
 */
export async function withdrawQuote(
  db: PrismaClient,
  input: { businessId: string; quoteId: string },
): Promise<ServiceResult<WithdrawQuoteResult>> {
  const quote = await db.quote.findFirst({
    where: { id: input.quoteId, businessId: input.businessId },
    select: { id: true, status: true },
  });

  if (!quote) {
    return svcFail("NOT_FOUND", "Quote not found");
  }

  if (quote.status !== QuoteStatus.PENDING) {
    return svcFail("CONFLICT", "Quote is not pending");
  }

  const withdrawn = await db.quote.updateMany({
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

  return svcOk({ quoteId: quote.id, status: QuoteStatus.WITHDRAWN });
}
