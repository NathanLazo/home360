import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  QuoteStatus,
  RequestStatus,
  type GuaranteeType,
  type PrismaClient,
} from "@generated/prisma";
import { haversineKm } from "~/server/services/geo/haversine";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export const QUOTE_SORTS = ["recommended", "cheapest", "bestRated"] as const;

export type QuoteSort = (typeof QUOTE_SORTS)[number];

// Proximity assumed for quotes whose branch has no coordinates: the platform
// default notification radius, so geo-less businesses rank as "average
// distance" instead of winning or losing the badge by a missing geocode.
const UNKNOWN_DISTANCE_KM = 10;

const MAX_RATING = 5;

export type QuoteBusinessSummary = {
  name: string;
  ratingAvg: number | null;
  ratingCount: number;
  guaranteeType: GuaranteeType;
};

export type QuoteListItem = {
  id: string;
  status: QuoteStatus;
  /** Lets the customer open the profile and the chat (D10-12). */
  businessId: string;
  /** Request×business pre-order conversation, when one exists (D10-12). */
  conversationId: string | null;
  amountCents: number;
  scheduledFor: Date | null;
  message: string | null;
  /** Branch↔request Haversine; null when either side has no coordinates. */
  distanceKm: number | null;
  /** Best rating×proximity score of the list (C4 badge). */
  recommended: boolean;
  business: QuoteBusinessSummary;
};

export type QuoteBusinessProfile = QuoteBusinessSummary & {
  completedOrders: number;
  /**
   * Normative on-time formula (MA-12): orders with a WORK_DONE event at or
   * before their quote's scheduledFor ÷ COMPLETED orders with a non-null
   * quote.scheduledFor. Null without eligible orders (UI renders "—").
   */
  onTimePct: number | null;
};

export type QuoteDetail = {
  id: string;
  status: QuoteStatus;
  /** D10-12/13: profile + chat, the parent request and, once accepted, the order. */
  businessId: string;
  requestId: string;
  orderId: string | null;
  scheduledFor: Date | null;
  message: string | null;
  business: QuoteBusinessProfile;
  // No "materials" line: Quote does not reference products and quote.submit
  // does not capture them (MA-07).
  breakdown: {
    laborCents: number;
    serviceFeeCents: number;
    totalCents: number;
  };
};

export type AcceptQuoteResult = { orderId: string };

type ScoredQuote = QuoteListItem & { score: number };

/**
 * C4 ranking score: normalized business rating discounted by distance. An
 * unrated business scores 0 (it can never carry the badge over a rated one)
 * and a geo-less branch is treated as `UNKNOWN_DISTANCE_KM` away.
 */
function recommendationScore(
  ratingAvg: number | null,
  distanceKm: number | null,
): number {
  const ratingScore = (ratingAvg ?? 0) / MAX_RATING;

  return ratingScore / (1 + (distanceKm ?? UNKNOWN_DISTANCE_KM));
}

function sortQuotes(quotes: ScoredQuote[], sort: QuoteSort): ScoredQuote[] {
  const bySort: Record<QuoteSort, (a: ScoredQuote, b: ScoredQuote) => number> =
    {
      recommended: (a, b) => b.score - a.score || a.amountCents - b.amountCents,
      cheapest: (a, b) => a.amountCents - b.amountCents || b.score - a.score,
      bestRated: (a, b) =>
        (b.business.ratingAvg ?? -1) - (a.business.ratingAvg ?? -1) ||
        b.business.ratingCount - a.business.ratingCount ||
        a.amountCents - b.amountCents,
    };

  return [...quotes].sort(bySort[sort]);
}

/**
 * Quotes of an own request in one status (default PENDING, D10-13), ranked
 * for the C4 comparator. A foreign request answers a generic NOT_FOUND. The
 * badge goes to the single best rating×proximity score regardless of the
 * requested sort.
 */
export async function listQuotesByRequest(
  db: PrismaClient,
  input: {
    customerId: string;
    requestId: string;
    sort: QuoteSort;
    status?: QuoteStatus;
  },
): Promise<ServiceResult<QuoteListItem[]>> {
  const request = await db.serviceRequest.findFirst({
    where: { id: input.requestId, customerId: input.customerId },
    select: { latitude: true, longitude: true },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const rows = await db.quote.findMany({
    where: {
      requestId: input.requestId,
      status: input.status ?? QuoteStatus.PENDING,
    },
    select: {
      id: true,
      status: true,
      businessId: true,
      amountCents: true,
      scheduledFor: true,
      message: true,
      business: {
        select: {
          name: true,
          ratingAvg: true,
          ratingCount: true,
          guaranteeType: true,
        },
      },
      branch: { select: { latitude: true, longitude: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const conversations = await db.conversation.findMany({
    where: {
      requestId: input.requestId,
      businessId: { in: rows.map((row) => row.businessId) },
    },
    select: { id: true, businessId: true },
  });
  const conversationByBusiness = new Map(
    conversations.map((conversation) => [
      conversation.businessId,
      conversation.id,
    ]),
  );

  const scored: ScoredQuote[] = rows.map((row) => {
    const origin =
      request.latitude !== null && request.longitude !== null
        ? { latitude: request.latitude, longitude: request.longitude }
        : null;
    const branch =
      row.branch?.latitude != null && row.branch.longitude != null
        ? { latitude: row.branch.latitude, longitude: row.branch.longitude }
        : null;
    const distanceKm =
      origin !== null && branch !== null ? haversineKm(origin, branch) : null;

    return {
      id: row.id,
      status: row.status,
      businessId: row.businessId,
      conversationId: conversationByBusiness.get(row.businessId) ?? null,
      amountCents: row.amountCents,
      scheduledFor: row.scheduledFor,
      message: row.message,
      distanceKm,
      recommended: false,
      business: row.business,
      score: recommendationScore(row.business.ratingAvg, distanceKm),
    };
  });

  const best = sortQuotes(scored, "recommended")[0];

  if (best) {
    best.recommended = true;
  }

  return svcOk(
    sortQuotes(scored, input.sort).map(({ score: _score, ...item }) => item),
  );
}

/**
 * C5 detail of a quote over an own request: business profile with stats and
 * the money breakdown. Labor is `Quote.amountCents` and the service fee comes
 * from PlatformSettings; total = labor + fee (the payment lands in M3-W2).
 */
export async function getMyQuote(
  db: PrismaClient,
  input: { customerId: string; quoteId: string },
): Promise<ServiceResult<QuoteDetail>> {
  const quote = await db.quote.findFirst({
    where: { id: input.quoteId, request: { customerId: input.customerId } },
    select: {
      id: true,
      status: true,
      amountCents: true,
      scheduledFor: true,
      message: true,
      businessId: true,
      requestId: true,
      order: { select: { id: true } },
      business: {
        select: {
          name: true,
          ratingAvg: true,
          ratingCount: true,
          guaranteeType: true,
        },
      },
    },
  });

  if (!quote) {
    return svcFail("NOT_FOUND", "Quote not found");
  }

  const [settings, completedOrders, eligibleOrders] = await Promise.all([
    db.platformSettings.findUnique({
      where: { id: 1 },
      select: { customerServiceFeeCents: true },
    }),
    db.order.count({
      where: { businessId: quote.businessId, status: OrderStatus.COMPLETED },
    }),
    db.order.findMany({
      where: {
        businessId: quote.businessId,
        status: OrderStatus.COMPLETED,
        quote: { is: { scheduledFor: { not: null } } },
      },
      select: {
        quote: { select: { scheduledFor: true } },
        events: {
          where: { type: OrderEventType.WORK_DONE },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
  ]);

  if (!settings) {
    return svcFail("CONFLICT", "Platform settings are not configured");
  }

  const onTimeOrders = eligibleOrders.filter((order) => {
    const scheduledFor = order.quote?.scheduledFor;
    const workDoneAt = order.events[0]?.createdAt;

    return (
      scheduledFor !== null &&
      scheduledFor !== undefined &&
      workDoneAt !== undefined &&
      workDoneAt.getTime() <= scheduledFor.getTime()
    );
  }).length;
  const onTimePct =
    eligibleOrders.length === 0
      ? null
      : Math.round((onTimeOrders / eligibleOrders.length) * 100);

  return svcOk({
    id: quote.id,
    status: quote.status,
    businessId: quote.businessId,
    requestId: quote.requestId,
    orderId: quote.order?.id ?? null,
    scheduledFor: quote.scheduledFor,
    message: quote.message,
    business: {
      ...quote.business,
      completedOrders,
      onTimePct,
    },
    breakdown: {
      laborCents: quote.amountCents,
      serviceFeeCents: settings.customerServiceFeeCents,
      totalCents: quote.amountCents + settings.customerServiceFeeCents,
    },
  });
}

/**
 * Accepts a PENDING quote of an own request in one transaction: the winner
 * becomes ACCEPTED, sibling PENDING quotes EXPIRE, the request closes as
 * ACCEPTED and the SERVICE Order is created with status `PENDING` (F0
 * semantics `PENDING → PAID`, MA-04) plus its ACCEPTED OrderEvent.
 * `workerId` is copied from the quote (MA-01) and a pre-order conversation of
 * the winning [requestId, businessId] pair is re-linked to the Order (MA-08).
 * Payment arrives in M3-W2.
 */
export async function acceptQuote(
  db: PrismaClient,
  input: { customerId: string; quoteId: string },
): Promise<ServiceResult<AcceptQuoteResult, "REQUEST_EXPIRED">> {
  const now = new Date();
  const accepted = await db.$transaction<
    ServiceResult<
      AcceptQuoteResult & { businessOwnerId: string },
      "REQUEST_EXPIRED"
    >
  >(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: { id: input.quoteId, request: { customerId: input.customerId } },
      select: {
        id: true,
        status: true,
        amountCents: true,
        requestId: true,
        businessId: true,
        branchId: true,
        workerId: true,
        business: { select: { ownerId: true } },
        request: {
          select: {
            title: true,
            status: true,
            expiresAt: true,
            corporateAccountId: true,
            corporateLocationId: true,
          },
        },
      },
    });

    if (!quote) {
      return svcFail("NOT_FOUND", "Quote not found");
    }

    if (quote.status !== QuoteStatus.PENDING) {
      return svcFail("CONFLICT", "Quote is not pending");
    }

    if (
      quote.request.status !== RequestStatus.OPEN &&
      quote.request.status !== RequestStatus.QUOTED
    ) {
      return svcFail("CONFLICT", "Request is no longer open");
    }

    // D10-5: an expired request no longer accepts offers.
    if (
      quote.request.expiresAt !== null &&
      quote.request.expiresAt.getTime() <= now.getTime()
    ) {
      return svcFail("REQUEST_EXPIRED", "Request has expired");
    }

    // Conditional claim: a concurrent accept of the same quote loses here
    // instead of double-creating the Order.
    const claimed = await tx.quote.updateMany({
      where: { id: quote.id, status: QuoteStatus.PENDING },
      data: { status: QuoteStatus.ACCEPTED },
    });

    if (claimed.count === 0) {
      return svcFail("CONFLICT", "Quote is not pending");
    }

    await tx.quote.updateMany({
      where: {
        requestId: quote.requestId,
        id: { not: quote.id },
        status: QuoteStatus.PENDING,
      },
      data: { status: QuoteStatus.EXPIRED },
    });
    await tx.serviceRequest.update({
      where: { id: quote.requestId },
      data: { status: RequestStatus.ACCEPTED },
    });

    // serviceId stays null: Quote has no Service FK to copy (see M3 findings).
    const order = await tx.order.create({
      data: {
        type: OrderType.SERVICE,
        title: quote.request.title,
        status: OrderStatus.PENDING,
        amountCents: quote.amountCents,
        customerId: input.customerId,
        businessId: quote.businessId,
        branchId: quote.branchId,
        workerId: quote.workerId,
        quoteId: quote.id,
        quantity: 1,
        // Corporate consumer (F7): the order inherits the account/location
        // the request was raised for, so commission resolution applies the
        // preferential corporate rate at checkout.
        corporateAccountId: quote.request.corporateAccountId,
        corporateLocationId: quote.request.corporateLocationId,
      },
      select: { id: true },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: OrderEventType.ACCEPTED,
        actorUserId: input.customerId,
      },
    });

    const conversation = await tx.conversation.findUnique({
      where: {
        requestId_businessId: {
          requestId: quote.requestId,
          businessId: quote.businessId,
        },
      },
      select: { id: true },
    });

    if (conversation) {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { orderId: order.id },
      });
    }

    return svcOk({
      orderId: order.id,
      businessOwnerId: quote.business.ownerId,
    });
  });

  if (!accepted.ok) {
    return accepted;
  }

  // D10-15: the winning business learns its quote was accepted.
  await sendLocalizedPushToUser(db, accepted.data.businessOwnerId, {
    message: "quoteAccepted",
    url: `home360app://orders/${accepted.data.orderId}`,
  });

  return svcOk({ orderId: accepted.data.orderId });
}
