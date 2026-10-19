import "server-only";

import {
  BusinessStatus,
  ProductStatus,
  type MessageType,
  type PrismaClient,
  type UserRole,
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

export type ConversationKind = "ORDER" | "REQUEST" | "INQUIRY";

export type ConversationListItem = {
  conversationId: string;
  /** ORDER (post-acceptance), REQUEST (pre-order per quote) or INQUIRY (D10-12). */
  kind: ConversationKind;
  orderId: string | null;
  requestId: string | null;
  /** INQUIRY: the product the customer asked about, if any. */
  productId: string | null;
  /** Order folio + title, the request title or, for an inquiry, the product
   * (or business) name (MA-03). */
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
 * quote of their own on the request, or when the request is targeted at it
 * (D10-11). The consumer owning the request (CUSTOMER or the CORPORATE
 * owner) must name the `businessId` (now exposed by `quote.*`), which
 * likewise must have quoted or be the request's target. Everything else is
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
  } else if (input.role === "CUSTOMER" || input.role === "CORPORATE") {
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

  // Both roles converse across an existing quote of that pair (N2) or a
  // request targeted at that business (D10-11).
  const [quote, targeted] = await Promise.all([
    db.quote.findUnique({
      where: {
        requestId_businessId: { requestId: input.requestId, businessId },
      },
      select: { id: true },
    }),
    db.serviceRequest.findFirst({
      where: { id: input.requestId, targetBusinessId: businessId },
      select: { id: true },
    }),
  ]);

  if (!quote && !targeted) {
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
 * Pre-sale inquiry chat (D10-12): one conversation per customer × business,
 * opened by the consumer from a business profile or product page. The
 * business must be ACTIVE; an optional `productId` must be one of its
 * PUBLISHED products and becomes the conversation's current subject. Never
 * re-linked to an order (orders keep their own conversation).
 */
export async function getOrCreateInquiry(
  db: PrismaClient,
  input: { customerId: string; businessId: string; productId?: string },
): Promise<ServiceResult<ConversationRef>> {
  const business = await db.business.findFirst({
    where: { id: input.businessId, status: BusinessStatus.ACTIVE },
    select: { id: true, ownerId: true },
  });

  if (!business || business.ownerId === input.customerId) {
    return svcFail("NOT_FOUND", "Business not found");
  }

  if (input.productId) {
    const product = await db.product.findFirst({
      where: {
        id: input.productId,
        businessId: business.id,
        status: ProductStatus.PUBLISHED,
      },
      select: { id: true },
    });

    if (!product) {
      return svcFail("NOT_FOUND", "Product not found");
    }
  }

  const conversation = await db.conversation.upsert({
    where: {
      businessId_customerId: {
        businessId: business.id,
        customerId: input.customerId,
      },
    },
    create: {
      businessId: business.id,
      customerId: input.customerId,
      productId: input.productId ?? null,
    },
    update: input.productId ? { productId: input.productId } : {},
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
      customerId: true,
      productId: true,
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
      customer: { select: { name: true } },
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

  const productIds = [
    ...new Set(
      conversations.flatMap((conversation) =>
        conversation.productId ? [conversation.productId] : [],
      ),
    ),
  ];
  const products =
    productIds.length === 0
      ? []
      : await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        });
  const productNames = new Map(
    products.map((product) => [product.id, product.name]),
  );
  const items = conversations
    .map((conversation) => toListItem(conversation, input.userId, productNames))
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
  customerId: string | null;
  productId: string | null;
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
  customer: { name: string | null } | null;
  messages: { type: MessageType; body: string | null; createdAt: Date }[];
  _count: { messages: number };
};

function toListItem(
  conversation: ConversationRow,
  userId: string,
  productNames: ReadonlyMap<string, string>,
): ConversationListItem & { activityAt: Date } {
  const lastMessage = conversation.messages[0] ?? null;

  let title = "";
  let counterpartName = "";
  let kind: ConversationKind = "INQUIRY";

  if (conversation.order) {
    const {
      folio,
      title: orderTitle,
      customerId,
      customer,
      business,
    } = conversation.order;

    kind = "ORDER";
    title = `#${folio} ${orderTitle}`;
    // The customer talks to the business; the business side (owner or
    // assigned worker) talks to the customer.
    counterpartName =
      customerId === userId ? business.name : (customer.name ?? "");
  } else if (conversation.request) {
    kind = "REQUEST";
    title = conversation.request.title;
    counterpartName =
      conversation.request.customerId === userId
        ? (conversation.business?.name ?? "")
        : (conversation.request.customer.name ?? "");
  } else {
    const businessName = conversation.business?.name ?? "";

    title =
      (conversation.productId
        ? productNames.get(conversation.productId)
        : undefined) ?? businessName;
    counterpartName =
      conversation.customerId === userId
        ? businessName
        : (conversation.customer?.name ?? "");
  }

  return {
    conversationId: conversation.id,
    kind,
    orderId: conversation.orderId,
    requestId: conversation.requestId,
    productId: conversation.productId,
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
