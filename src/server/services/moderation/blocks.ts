import "server-only";

import { Prisma, type PrismaClient } from "@generated/prisma";
import { isConversationParticipant } from "~/server/services/messaging/participants";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { getConversationParties } from "./conversation-parties";

type Pair = { customerId: string; businessId: string };

/** Block state of a chat as seen by the session user. */
export type ConversationBlockState = {
  blocked: boolean;
  /** The session user set the block, so only they can lift it. */
  blockedByMe: boolean;
  /** Customer and business owner can block; an assigned worker cannot. */
  canBlock: boolean;
};

export async function isPairBlocked(
  db: PrismaClient,
  pair: Pair,
): Promise<boolean> {
  // Build the compound key explicitly: callers may pass a wider object
  // (e.g. ConversationParties) and Prisma rejects unknown key fields.
  const block = await db.customerBusinessBlock.findUnique({
    where: {
      customerId_businessId: {
        customerId: pair.customerId,
        businessId: pair.businessId,
      },
    },
    select: { id: true },
  });

  return block !== null;
}

export async function isConversationBlocked(
  db: PrismaClient,
  conversationId: string,
): Promise<boolean> {
  const parties = await getConversationParties(db, conversationId);

  return parties !== null && (await isPairBlocked(db, parties));
}

export async function getConversationBlockState(
  db: PrismaClient,
  input: { userId: string; conversationId: string },
): Promise<ServiceResult<ConversationBlockState>> {
  const parties = await getConversationParties(db, input.conversationId);

  if (
    !parties ||
    !(await isConversationParticipant(db, input.userId, input.conversationId))
  ) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  const block = await db.customerBusinessBlock.findUnique({
    where: {
      customerId_businessId: {
        customerId: parties.customerId,
        businessId: parties.businessId,
      },
    },
    select: { blockedById: true },
  });

  return svcOk({
    blocked: block !== null,
    blockedByMe: block?.blockedById === input.userId,
    canBlock:
      input.userId === parties.customerId ||
      input.userId === parties.businessOwnerId,
  });
}

/**
 * Blocks the customer×business pair behind a chat (App Store 1.2). Only the
 * customer or the business owner may do it; idempotent when already blocked.
 */
export async function blockConversation(
  db: PrismaClient,
  input: { userId: string; conversationId: string },
): Promise<ServiceResult<ConversationBlockState, "FORBIDDEN">> {
  const state = await getConversationBlockState(db, input);

  if (!state.ok) {
    return state;
  }

  if (!state.data.canBlock) {
    return svcFail("FORBIDDEN", "Only the customer or the owner can block");
  }

  if (state.data.blocked) {
    return svcOk(state.data);
  }

  const parties = await getConversationParties(db, input.conversationId);

  if (!parties) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  try {
    await db.customerBusinessBlock.create({
      data: {
        customerId: parties.customerId,
        businessId: parties.businessId,
        blockedById: input.userId,
      },
    });
  } catch (error) {
    // A concurrent block by the other side already exists: keep it.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  return getConversationBlockState(db, input);
}

/** Lifts a block; only the side that set it can. Idempotent when unblocked. */
export async function unblockConversation(
  db: PrismaClient,
  input: { userId: string; conversationId: string },
): Promise<ServiceResult<ConversationBlockState, "FORBIDDEN">> {
  const state = await getConversationBlockState(db, input);

  if (!state.ok) {
    return state;
  }

  if (!state.data.blocked) {
    return svcOk(state.data);
  }

  if (!state.data.blockedByMe) {
    return svcFail("FORBIDDEN", "Only the side that blocked can unblock");
  }

  const parties = await getConversationParties(db, input.conversationId);

  if (!parties) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  await db.customerBusinessBlock.deleteMany({
    where: {
      customerId: parties.customerId,
      businessId: parties.businessId,
      blockedById: input.userId,
    },
  });

  return getConversationBlockState(db, input);
}
