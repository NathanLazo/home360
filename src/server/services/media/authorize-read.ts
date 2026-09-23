import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { getConversationParticipantIds } from "~/server/services/messaging/participants";
import { isRequestVisibleOnRadar } from "~/server/services/orders/radar-visibility";

/**
 * Read authorization by persisted reference (MA-02): resolves who may read a
 * blob that the caller does not own by prefix, before the URL is signed.
 *
 * Branches:
 * - `chatAttachment` (M4-W1): pathname on a Message → conversation participants.
 * - request evidence (M5-W1): pathname on ServiceRequest.photoUrls → business
 *   that sees the request on the radar (OPEN + radius + category) or that
 *   already has a quote on it.
 * - order evidence (M6-W1): request/before/after/recording media for the
 *   customer, business owner, assigned worker or an administrator, including
 *   evidence attached to the order's dispute by either party.
 */
export async function authorizeMediaRead(
  db: PrismaClient,
  userId: string,
  pathname: string,
): Promise<boolean> {
  const message = await db.message.findFirst({
    where: { attachmentUrl: pathname },
    select: { conversationId: true },
  });

  if (message) {
    const participantIds = await getConversationParticipantIds(
      db,
      message.conversationId,
    );

    return participantIds?.includes(userId) ?? false;
  }

  if (await authorizeOrderEvidenceRead(db, userId, pathname)) {
    return true;
  }

  return authorizeRequestEvidenceRead(db, userId, pathname);
}

async function authorizeOrderEvidenceRead(
  db: PrismaClient,
  userId: string,
  pathname: string,
): Promise<boolean> {
  const order = await db.order.findFirst({
    where: {
      OR: [
        {
          quote: {
            is: { request: { is: { photoUrls: { has: pathname } } } },
          },
        },
        { beforeUrls: { has: pathname } },
        { afterUrls: { has: pathname } },
        { recordingUrl: pathname },
        { recordingSegments: { some: { pathname } } },
        // Dispute evidence is shared by both parties of the order (W11).
        { dispute: { is: { evidenceUrls: { has: pathname } } } },
      ],
    },
    select: {
      customerId: true,
      business: { select: { ownerId: true } },
      worker: { select: { userId: true } },
    },
  });

  if (!order) {
    return false;
  }

  if (
    order.customerId === userId ||
    order.business.ownerId === userId ||
    order.worker?.userId === userId
  ) {
    return true;
  }

  const admin = await db.user.findFirst({
    where: { id: userId, role: "ADMIN" },
    select: { id: true },
  });

  return admin !== null;
}

/**
 * Business owners may read request evidence when the request is visible on
 * their radar or they already hold a quote on that request (MA-02 / M5-W1).
 */
async function authorizeRequestEvidenceRead(
  db: PrismaClient,
  userId: string,
  pathname: string,
): Promise<boolean> {
  const request = await db.serviceRequest.findFirst({
    where: { photoUrls: { has: pathname } },
    select: { id: true },
  });

  if (!request) {
    return false;
  }

  const business = await db.business.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });

  if (!business) {
    return false;
  }

  const ownQuote = await db.quote.findUnique({
    where: {
      requestId_businessId: {
        requestId: request.id,
        businessId: business.id,
      },
    },
    select: { id: true },
  });

  if (ownQuote) {
    return true;
  }

  return isRequestVisibleOnRadar(db, {
    businessId: business.id,
    requestId: request.id,
  });
}
