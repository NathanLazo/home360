import "server-only";

import type {
  Message,
  MessageType,
  PrismaClient,
} from "../../../../generated/prisma";
import { isOwnedMediaPathname } from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { conversationChannel } from "./channels";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import {
  getConversationParticipantIds,
  isConversationParticipant,
} from "./participants";
import { triggerPusherEvent } from "./pusher-server";

/**
 * Persists one chat message and notifies the conversation channel (M4-W1).
 * Persistence rules: the message is written first and the Pusher event only
 * carries ids, so a Pusher outage or missing envs degrade to polling without
 * losing anything. Attachments must be `chatAttachment` blob pathnames owned
 * by the sender (issued by `media.createUploadUrl`).
 */
export async function sendMessage(
  db: PrismaClient,
  input: {
    senderId: string;
    conversationId: string;
    type: MessageType;
    body?: string;
    attachmentPathname?: string;
    lat?: number;
    lng?: number;
  },
): Promise<ServiceResult<Message, "VALIDATION_ERROR">> {
  const participant = await isConversationParticipant(
    db,
    input.senderId,
    input.conversationId,
  );

  if (!participant) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  if (input.type === "TEXT" && !input.body) {
    return svcFail("VALIDATION_ERROR", "TEXT messages require a body");
  }

  if (input.type === "IMAGE") {
    if (
      !input.attachmentPathname ||
      !isOwnedMediaPathname(input.attachmentPathname, input.senderId, [
        "chatAttachment",
      ])
    ) {
      return svcFail(
        "VALIDATION_ERROR",
        "IMAGE messages require an own chatAttachment pathname",
      );
    }
  }

  if (
    input.type === "LOCATION" &&
    (input.lat === undefined || input.lng === undefined)
  ) {
    return svcFail("VALIDATION_ERROR", "LOCATION messages require lat and lng");
  }

  const message = await db.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      type: input.type,
      body: input.type === "LOCATION" ? null : (input.body ?? null),
      attachmentUrl:
        input.type === "IMAGE" ? (input.attachmentPathname ?? null) : null,
      latitude: input.type === "LOCATION" ? input.lat : null,
      longitude: input.type === "LOCATION" ? input.lng : null,
    },
  });

  await triggerPusherEvent(
    [conversationChannel(input.conversationId)],
    "message:new",
    {
      messageId: message.id,
      conversationId: input.conversationId,
      senderId: input.senderId,
      type: message.type,
    },
  );

  try {
    const participantIds = await getConversationParticipantIds(
      db,
      input.conversationId,
    );

    await Promise.all(
      (participantIds ?? [])
        .filter((userId) => userId !== input.senderId)
        .map((userId) =>
          sendLocalizedPushToUser(db, userId, {
            message: "newMessage",
            url: `home360app://conversation/${input.conversationId}`,
          }),
        ),
    );
  } catch {
    console.error("[messaging] PUSH_DELIVERY_FAILED", {
      conversationId: input.conversationId,
    });
  }

  return svcOk(message);
}
