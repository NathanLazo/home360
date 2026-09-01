import "server-only";

import type {
  MessageType,
  PrismaClient,
  UserRole,
} from "@generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  isConversationParticipant,
  isOrderParticipant,
  participantConversationsWhere,
} from "./participants";

const CONVERSATIONS_PAGE_SIZE = 30;
const MESSAGES_PAGE_SIZE = 30;

export type ConversationRef = { conversationId: string };

export type ConversationListItem = {
  conversationId: string;
  orderId: string | null;
  requestId: string | null;
  /** Order folio + title, or the request title (MA-03). */
  title: string;
  /** The other side of the chat, resolved against the session role. */
  counterpartName: string;
  lastMessage: {
    type: MessageType;
    body: string | null;
    createdAt: string;
  } | null;
  unreadCount: number;
};

export type ConversationList = {
  items: ConversationListItem[];
  nextCursor: string | null;
};

/**
 * Upserts the single conversation of an order (M4-W1). Only order
 * participants (customer, business owner, assigned worker) may open it; a
 * foreign or unknown order answers a generic NOT_FOUND.
 */
export async function getOrCreateForOrder(
  db: PrismaClient,
  input: { userId: string; orderId: string },
): Promise<ServiceResult<ConversationRef>> {
  const participant = await isOrderParticipant(db, input.userId, input.orderId);

  if (!participant) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  const conversation = await db.conversation.upsert({
    where: { orderId: input.orderId },
    create: { orderId: input.orderId },
    update: {},
    select: { id: true },
  });

  return svcOk({ conversationId: conversation.id });
}

/**
 * Upserts the pre-order conversation of a request×business pair (MA-08).
 * A business owner opens it against their own business — but only with a
 * quote of their own on the request. The customer owning the request must
 * name the `businessId`, which likewise must have quoted. Everything else is
 * a generic NOT_FOUND so the response never reveals whether the request or
 * the quote exists.
 */
export async function getOrCreateForRequest(
  db: PrismaClient,
  input: {
    userId: string;
    role: UserRole;
    requestId: string;
    businessId?: string;
  },
): Promise<ServiceResult<ConversationRef, "VALIDATION_ERROR">> {
  let businessId: string | null = null;

  if (input.role === "BUSINESS") {
    const business = await db.business.findUnique({
      where: { ownerId: input.userId },
      select: { id: true },
    });

    businessId = business?.id ?? null;
  } else if (input.role === "CUSTOMER") {
    if (!input.businessId) {
      return svcFail("VALIDATION_ERROR", "businessId is required");
    }

    const request = await db.serviceRequest.findFirst({
      where: { id: input.requestId, customerId: input.userId },
      select: { id: true },
    });

    businessId = request ? input.businessId : null;
  }

  if (!businessId) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  // Both roles converse only across an existing quote of that pair (N2).
  const quote = await db.quote.findUnique({
    where: {
      requestId_businessId: { requestId: input.requestId, businessId },
    },
    select: { id: true },
  });

  if (!quote) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const conversation = await db.conversation.upsert({
    where: {
      requestId_businessId: { requestId: input.requestId, businessId },
    },
    create: { requestId: input.requestId, businessId },
    update: {},
    select: { id: true },
  });

  return svcOk({ conversationId: conversation.id });
}

/**
 * Conversations where the session user participates, newest activity first
 * (MA-03; feeds the Messages tabs of M4-M1). The activity ordering needs the
 * last message of every conversation, so the whole participant set is read
 * and paginated in memory: per-user conversation counts are small by
 * construction (one per order or quoted request).
 */
export async function listMyConversations(
  db: PrismaClient,
  input: { userId: string; cursor?: string },
): Promise<ServiceResult<ConversationList>> {
  const conversations = await db.conversation.findMany({
    where: participantConversationsWhere(input.userId),
    select: {
      id: true,
      orderId: true,
      requestId: true,
      createdAt: true,
      order: {
        select: {
          folio: true,
          title: true,
          customerId: true,
          customer: { select: { name: true } },
          business: { select: { name: true } },
        },
      },
      request: {
        select: {
          title: true,
          customerId: true,
          customer: { select: { name: true } },
        },
      },
      business: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, body: true, createdAt: true },
      },
      _count: {
        select: {
          messages: {
            where: { senderId: { not: input.userId }, readAt: null },
          },
        },
      },
    },
  });

  const items = conversations
    .map((conversation) => toListItem(conversation, input.userId))
    .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());

  const cursorIndex = input.cursor
    ? items.findIndex((item) => item.conversationId === input.cursor)
    : -1;

  if (input.cursor && cursorIndex === -1) {
    return svcFail("NOT_FOUND", "Cursor not found");
  }

  const page = items.slice(
    cursorIndex + 1,
    cursorIndex + 1 + CONVERSATIONS_PAGE_SIZE,
  );
  const hasMore = cursorIndex + 1 + CONVERSATIONS_PAGE_SIZE < items.length;

  return svcOk({
    items: page.map(({ activityAt: _activityAt, ...item }) => item),
    nextCursor: hasMore ? (page.at(-1)?.conversationId ?? null) : null,
  });
}

type ConversationRow = {
  id: string;
  orderId: string | null;
  requestId: string | null;
  createdAt: Date;
  order: {
    folio: number;
    title: string;
    customerId: string;
    customer: { name: string | null };
    business: { name: string };
  } | null;
  request: {
    title: string;
    customerId: string;
    customer: { name: string | null };
  } | null;
  business: { name: string } | null;
  messages: { type: MessageType; body: string | null; createdAt: Date }[];
  _count: { messages: number };
};

function toListItem(
  conversation: ConversationRow,
  userId: string,
): ConversationListItem & { activityAt: Date } {
  const lastMessage = conversation.messages[0] ?? null;

  let title = "";
  let counterpartName = "";

  if (conversation.order) {
    const { folio, title: orderTitle, customerId, customer, business } =
      conversation.order;

    title = `#${folio} ${orderTitle}`;
    // The customer talks to the business; the business side (owner or
    // assigned worker) talks to the customer.
    counterpartName =
      customerId === userId ? business.name : (customer.name ?? "");
  } else if (conversation.request) {
    title = conversation.request.title;
    counterpartName =
      conversation.request.customerId === userId
        ? (conversation.business?.name ?? "")
        : (conversation.request.customer.name ?? "");
  }

  return {
    conversationId: conversation.id,
    orderId: conversation.orderId,
    requestId: conversation.requestId,
    title,
    counterpartName,
    lastMessage: lastMessage
      ? {
          type: lastMessage.type,
          body: lastMessage.body,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    unreadCount: conversation._count.messages,
    activityAt: lastMessage?.createdAt ?? conversation.createdAt,
  };
}

/**
 * Messages of one conversation, newest first, cursor-paginated. A
 * non-participant answers a generic NOT_FOUND.
 */
export async function listMessages(
  db: PrismaClient,
  input: { userId: string; conversationId: string; cursor?: string },
) {
  const participant = await isConversationParticipant(
    db,
    input.userId,
    input.conversationId,
  );

  if (!participant) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  const messages = await db.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGES_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = messages.length > MESSAGES_PAGE_SIZE;
  const items = hasMore ? messages.slice(0, MESSAGES_PAGE_SIZE) : messages;

  return svcOk({
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  });
}

/**
 * Marks every foreign message of the conversation as read. Idempotent; a
 * non-participant answers a generic NOT_FOUND.
 */
export async function markConversationRead(
  db: PrismaClient,
  input: { userId: string; conversationId: string },
): Promise<ServiceResult<{ readCount: number }>> {
  const participant = await isConversationParticipant(
    db,
    input.userId,
    input.conversationId,
  );

  if (!participant) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  const result = await db.message.updateMany({
    where: {
      conversationId: input.conversationId,
      senderId: { not: input.userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return svcOk({ readCount: result.count });
}
