import "server-only";

import type { Prisma, PrismaClient } from "@generated/prisma";

/**
 * Single source of truth for "who can see a conversation" (M4-W1), reused by
 * every messaging procedure, the media read authorization (MA-02) and the
 * Pusher channel auth endpoint.
 *
 * Per-order conversation: the order's customer, the owner of the business and
 * the assigned worker (`Order.workerId`, MA-01). Per-request conversation
 * (`requestId` + `businessId`, MA-08): the request's customer and the owner of
 * the quoting business. Once `quote.accept` re-links the conversation to an
 * Order, the order rule wins.
 */
export async function getConversationParticipantIds(
  db: PrismaClient,
  conversationId: string,
): Promise<string[] | null> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      order: {
        select: {
          customerId: true,
          business: { select: { ownerId: true } },
          worker: { select: { userId: true } },
        },
      },
      request: { select: { customerId: true } },
      business: { select: { ownerId: true } },
    },
  });

  if (!conversation) {
    return null;
  }

  if (conversation.order) {
    const { customerId, business, worker } = conversation.order;

    return [customerId, business.ownerId, worker?.userId].filter(
      (id): id is string => typeof id === "string",
    );
  }

  if (conversation.request && conversation.business) {
    return [conversation.request.customerId, conversation.business.ownerId];
  }

  // A conversation without order and without request×business pair cannot be
  // produced by the routers; deny by construction.
  return [];
}

export async function isConversationParticipant(
  db: PrismaClient,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const participantIds = await getConversationParticipantIds(
    db,
    conversationId,
  );

  return participantIds?.includes(userId) ?? false;
}

/**
 * Same participant rule applied to the order itself, for the
 * `private-order-{id}` tracking channel (M4-W2) whose auth ships here.
 */
export async function isOrderParticipant(
  db: PrismaClient,
  userId: string,
  orderId: string,
): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      customerId: true,
      business: { select: { ownerId: true } },
      worker: { select: { userId: true } },
    },
  });

  if (!order) {
    return false;
  }

  return (
    order.customerId === userId ||
    order.business.ownerId === userId ||
    order.worker?.userId === userId
  );
}

/**
 * Prisma `where` filter matching every conversation the user participates in,
 * mirroring `getConversationParticipantIds` for list queries. The
 * `orderId: null` gates keep re-linked conversations governed by the order
 * rule only.
 */
export function participantConversationsWhere(
  userId: string,
): Prisma.ConversationWhereInput {
  return {
    OR: [
      { order: { customerId: userId } },
      { order: { business: { ownerId: userId } } },
      { order: { worker: { userId } } },
      { orderId: null, request: { customerId: userId } },
      { orderId: null, business: { ownerId: userId } },
    ],
  };
}
