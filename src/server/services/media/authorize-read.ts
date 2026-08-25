import "server-only";

import type { PrismaClient } from "../../../../generated/prisma";
import { getConversationParticipantIds } from "~/server/services/messaging/participants";

/**
 * Read authorization by persisted reference (MA-02): resolves who may read a
 * blob that the caller does not own by prefix, before the URL is signed.
 *
 * M4-W1 ships the `chatAttachment` branch: a pathname referenced by a
 * `Message.attachmentUrl` is readable by every participant of that message's
 * conversation. M5-W1 (request evidence) and M6-W1 (order evidence) add their
 * branches over this same helper.
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

  if (!message) {
    return false;
  }

  const participantIds = await getConversationParticipantIds(
    db,
    message.conversationId,
  );

  return participantIds?.includes(userId) ?? false;
}
