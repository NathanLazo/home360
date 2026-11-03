import { MessageType } from "@generated/prisma";
import { tool } from "ai";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";
import { runTool, type AgentCaller } from "../tool-runtime";

const cursor = recordIdSchema
  .optional()
  .describe("Cursor from the previous page.");

/**
 * Human chat with customers (orders and pre-sale requests). Participation is
 * enforced by the messaging service: a foreign conversation is a NOT_FOUND.
 */
export function createBusinessMessagingTools(caller: AgentCaller) {
  return {
    listConversations: tool({
      description:
        "Chats of the business with customers (per order or per radar request), newest first, with last message and unread count.",
      inputSchema: z.object({ cursor }),
      execute: (input) =>
        runTool(() => caller.messaging.listMyConversations(input)),
    }),
    listConversationMessages: tool({
      description: "Messages of one conversation, newest first.",
      inputSchema: z.object({ conversationId: recordIdSchema, cursor }),
      execute: (input) => runTool(() => caller.messaging.listMessages(input)),
    }),
    openOrderConversation: tool({
      description:
        "Get (or create) the chat with the customer of one order. Returns the conversationId for sendCustomerMessage.",
      inputSchema: z.object({ orderId: recordIdSchema }),
      execute: (input) =>
        runTool(() => caller.messaging.getOrCreateConversation(input)),
    }),
    openRequestConversation: tool({
      description:
        "Get (or create) the pre-sale chat with the customer of a radar request. Only works once the business quoted it or the request targets the business.",
      inputSchema: z.object({ requestId: recordIdSchema }),
      execute: (input) =>
        runTool(() => caller.messaging.getOrCreateForRequest(input)),
    }),
    sendCustomerMessage: tool({
      description:
        "Send a text message to a customer in a conversation, in the name of the business. Confirm the exact text with the user first.",
      inputSchema: z.object({
        conversationId: recordIdSchema,
        body: z.string().trim().min(1).max(2_000),
      }),
      execute: ({ conversationId, body }) =>
        runTool(() =>
          caller.messaging.send({
            conversationId,
            type: MessageType.TEXT,
            body,
          }),
        ),
    }),
    markConversationRead: tool({
      description: "Mark a conversation as read.",
      inputSchema: z.object({ conversationId: recordIdSchema }),
      execute: (input) => runTool(() => caller.messaging.markRead(input)),
    }),
  };
}
