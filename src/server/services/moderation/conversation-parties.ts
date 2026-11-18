import "server-only";

import type { PrismaClient } from "@generated/prisma";

/** The two sides of every human chat: one customer and one business. */
export type ConversationParties = {
  customerId: string;
  businessId: string;
  businessOwnerId: string;
};

/**
 * Resolves the customer×business pair behind a conversation with the same
 * precedence as `getConversationParticipantIds`: the order wins once a
 * request conversation is re-linked, then request×business, then inquiry.
 */
export async function getConversationParties(
  db: PrismaClient,
  conversationId: string,
): Promise<ConversationParties | null> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      customerId: true,
      order: {
        select: {
          customerId: true,
          business: { select: { id: true, ownerId: true } },
        },
      },
      request: { select: { customerId: true } },
      business: { select: { id: true, ownerId: true } },
    },
  });

  if (!conversation) {
    return null;
  }

  if (conversation.order) {
    return {
      customerId: conversation.order.customerId,
      businessId: conversation.order.business.id,
      businessOwnerId: conversation.order.business.ownerId,
    };
  }

  const customerId =
    conversation.request?.customerId ?? conversation.customerId;

  if (!customerId || !conversation.business) {
    return null;
  }

  return {
    customerId,
    businessId: conversation.business.id,
    businessOwnerId: conversation.business.ownerId,
  };
}
