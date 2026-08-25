import { z } from "zod";

import { MessageType } from "../../../../generated/prisma";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getOrCreateForOrder,
  getOrCreateForRequest,
  listMessages,
  listMyConversations,
  markConversationRead,
} from "~/server/services/messaging/conversations";
import { sendMessage } from "~/server/services/messaging/send-message";

const MAX_BODY_LENGTH = 2_000;

const orderIdSchema = z.object({ orderId: z.string().cuid() });

const forRequestSchema = z.object({
  requestId: z.string().cuid(),
  businessId: z.string().cuid().optional(),
});

const cursorSchema = z.object({ cursor: z.string().cuid().optional() });

const conversationCursorSchema = z.object({
  conversationId: z.string().cuid(),
  cursor: z.string().cuid().optional(),
});

const conversationIdSchema = z.object({ conversationId: z.string().cuid() });

const sendSchema = z.object({
  conversationId: z.string().cuid(),
  type: z.nativeEnum(MessageType),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH).optional(),
  attachmentPathname: z.string().trim().min(1).max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/** HTTP status per service code; a non-participant is always a generic 404. */
const serviceErrorStatuses = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * Human chat customer↔business↔worker tied to the order or to a pre-order
 * request×business pair (M4-W1, N3/C6). Every procedure guards by
 * participation through the messaging service — never in the UI — and a
 * non-participant always receives a generic NOT_FOUND. Real time is
 * best-effort Pusher; the persisted `Message` rows rule.
 */
export const messagingRouter = createTRPCRouter({
  getOrCreateConversation: protectedProcedure
    .input(orderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const conversation = await getOrCreateForOrder(ctx.db, {
          userId: ctx.session.user.id,
          orderId: input.orderId,
        });

        if (!conversation.ok) {
          return serviceFailure(conversation.code, "Conversation load failed");
        }

        return ok(conversation.data, "Conversation ready");
      } catch (error) {
        return unexpectedFailure(error, "Conversation load failed");
      }
    }),

  getOrCreateForRequest: protectedProcedure
    .input(forRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const conversation = await getOrCreateForRequest(ctx.db, {
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
          requestId: input.requestId,
          businessId: input.businessId,
        });

        if (!conversation.ok) {
          return serviceFailure(conversation.code, "Conversation load failed");
        }

        return ok(conversation.data, "Conversation ready");
      } catch (error) {
        return unexpectedFailure(error, "Conversation load failed");
      }
    }),

  listMyConversations: protectedProcedure
    .input(cursorSchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMyConversations(ctx.db, {
          userId: ctx.session.user.id,
          cursor: input?.cursor,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Conversation list failed");
        }

        return ok(list.data, "Conversations loaded");
      } catch (error) {
        return unexpectedFailure(error, "Conversation list failed");
      }
    }),

  listMessages: protectedProcedure
    .input(conversationCursorSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listMessages(ctx.db, {
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
          cursor: input.cursor,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Message list failed");
        }

        return ok(list.data, "Messages loaded");
      } catch (error) {
        return unexpectedFailure(error, "Message list failed");
      }
    }),

  send: protectedProcedure
    .input(sendSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const message = await sendMessage(ctx.db, {
          senderId: ctx.session.user.id,
          conversationId: input.conversationId,
          type: input.type,
          body: input.body,
          attachmentPathname: input.attachmentPathname,
          lat: input.lat,
          lng: input.lng,
        });

        if (!message.ok) {
          return serviceFailure(message.code, "Message send failed");
        }

        return ok(message.data, "Message sent", 201);
      } catch (error) {
        return unexpectedFailure(error, "Message send failed");
      }
    }),

  markRead: protectedProcedure
    .input(conversationIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const marked = await markConversationRead(ctx.db, {
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });

        if (!marked.ok) {
          return serviceFailure(marked.code, "Mark read failed");
        }

        return ok(marked.data, "Conversation marked as read");
      } catch (error) {
        return unexpectedFailure(error, "Mark read failed");
      }
    }),
});
