import "server-only";

import type {
  OrderEventType,
  PrismaClient,
  WithdrawalStatus,
} from "@generated/prisma";

/** Items kept in the bell; older activity lives in orders/payments screens. */
export const BUSINESS_FEED_LIMIT = 20;

/** Order lifecycle events worth a notification for the business owner. */
const FEED_ORDER_EVENTS = [
  "ESCROW_HELD",
  "ACCEPTED",
  "CONFIRMED",
  "AUTO_RELEASED",
] as const satisfies readonly OrderEventType[];

type FeedOrderEvent = (typeof FEED_ORDER_EVENTS)[number];

/** Withdrawal states that are news to the owner (they created REQUESTED). */
const FEED_WITHDRAWAL_STATUSES = [
  "PROCESSING",
  "APPROVED",
  "REJECTED",
  "FAILED",
] as const satisfies readonly WithdrawalStatus[];

type FeedWithdrawalStatus = (typeof FEED_WITHDRAWAL_STATUSES)[number];

const ORDER_EVENT_KINDS = {
  ESCROW_HELD: "orderPaid",
  ACCEPTED: "quoteAccepted",
  CONFIRMED: "orderConfirmed",
  AUTO_RELEASED: "autoReleased",
} as const satisfies Record<FeedOrderEvent, string>;

const WITHDRAWAL_KINDS = {
  PROCESSING: "withdrawalProcessing",
  APPROVED: "withdrawalApproved",
  REJECTED: "withdrawalRejected",
  FAILED: "withdrawalFailed",
} as const satisfies Record<FeedWithdrawalStatus, string>;

export type BusinessFeedKind =
  | (typeof ORDER_EVENT_KINDS)[FeedOrderEvent]
  | (typeof WITHDRAWAL_KINDS)[FeedWithdrawalStatus]
  | "disputeOpened"
  | "disputeResolved";

export type BusinessFeedItem = {
  id: string;
  kind: BusinessFeedKind;
  createdAt: Date;
  /** Order the item links to; `null` for money items (payments screen). */
  order: { id: string; folio: number; title: string } | null;
  amountCents: number | null;
  unread: boolean;
};

export type BusinessFeed = {
  items: BusinessFeedItem[];
  unreadCount: number;
  seenAt: Date | null;
};

const feedOrderSelect = { id: true, folio: true, title: true } as const;

type FeedCandidate = Omit<BusinessFeedItem, "unread">;

/**
 * Derived notification feed (no notification table): recent order events,
 * disputes and withdrawal updates for one business, newest first. Events the
 * owner triggered themselves are skipped — nobody needs to be told what they
 * just did.
 */
export async function getBusinessFeed(
  db: PrismaClient,
  business: { id: string; ownerId: string },
): Promise<BusinessFeed> {
  const [record, events, disputes, withdrawals] = await Promise.all([
    db.business.findUnique({
      where: { id: business.id },
      select: { notificationsSeenAt: true },
    }),
    db.orderEvent.findMany({
      where: {
        type: { in: [...FEED_ORDER_EVENTS] },
        order: { is: { businessId: business.id } },
        OR: [{ actorUserId: null }, { actorUserId: { not: business.ownerId } }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: BUSINESS_FEED_LIMIT,
      select: {
        id: true,
        type: true,
        createdAt: true,
        order: { select: { ...feedOrderSelect, amountCents: true } },
      },
    }),
    db.dispute.findMany({
      where: { businessId: business.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: BUSINESS_FEED_LIMIT,
      select: {
        id: true,
        createdAt: true,
        resolvedAt: true,
        order: { select: feedOrderSelect },
      },
    }),
    db.withdrawal.findMany({
      where: {
        businessId: business.id,
        status: { in: [...FEED_WITHDRAWAL_STATUSES] },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: BUSINESS_FEED_LIMIT,
      select: {
        id: true,
        status: true,
        amountCents: true,
        updatedAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  const candidates: FeedCandidate[] = [];

  for (const event of events) {
    // Narrowed by the `in` filter above; the guard keeps the map total.
    if (!isFeedOrderEvent(event.type)) continue;
    candidates.push({
      id: `event:${event.id}`,
      kind: ORDER_EVENT_KINDS[event.type],
      createdAt: event.createdAt,
      order: {
        id: event.order.id,
        folio: event.order.folio,
        title: event.order.title,
      },
      amountCents: event.order.amountCents,
    });
  }

  for (const dispute of disputes) {
    candidates.push({
      id: `dispute:${dispute.id}:opened`,
      kind: "disputeOpened",
      createdAt: dispute.createdAt,
      order: dispute.order,
      amountCents: null,
    });
    if (dispute.resolvedAt) {
      candidates.push({
        id: `dispute:${dispute.id}:resolved`,
        kind: "disputeResolved",
        createdAt: dispute.resolvedAt,
        order: dispute.order,
        amountCents: null,
      });
    }
  }

  for (const withdrawal of withdrawals) {
    if (!isFeedWithdrawalStatus(withdrawal.status)) continue;
    candidates.push({
      id: `withdrawal:${withdrawal.id}:${withdrawal.status}`,
      kind: WITHDRAWAL_KINDS[withdrawal.status],
      createdAt: withdrawal.resolvedAt ?? withdrawal.updatedAt,
      order: null,
      amountCents: withdrawal.amountCents,
    });
  }

  const seenAt = record?.notificationsSeenAt ?? null;
  const items = candidates
    .sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id),
    )
    .slice(0, BUSINESS_FEED_LIMIT)
    .map((item): BusinessFeedItem => ({
      ...item,
      unread: seenAt === null || item.createdAt > seenAt,
    }));

  return {
    items,
    unreadCount: items.filter((item) => item.unread).length,
    seenAt,
  };
}

export async function markBusinessFeedSeen(
  db: PrismaClient,
  businessId: string,
  now = new Date(),
): Promise<{ seenAt: Date }> {
  await db.business.update({
    where: { id: businessId },
    data: { notificationsSeenAt: now },
    select: { id: true },
  });

  return { seenAt: now };
}

function isFeedOrderEvent(type: OrderEventType): type is FeedOrderEvent {
  return (FEED_ORDER_EVENTS as readonly OrderEventType[]).includes(type);
}

function isFeedWithdrawalStatus(
  status: WithdrawalStatus,
): status is FeedWithdrawalStatus {
  return (FEED_WITHDRAWAL_STATUSES as readonly WithdrawalStatus[]).includes(
    status,
  );
}
