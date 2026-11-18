import { z } from "zod";

import { ContentReportReason } from "@generated/prisma";
import { recordIdSchema } from "~/schemas/record-id.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  blockConversation,
  getConversationBlockState,
  unblockConversation,
} from "~/server/services/moderation/blocks";
import { reportConversationContent } from "~/server/services/moderation/report-content";

const conversationIdSchema = z.object({ conversationId: recordIdSchema });

const reportSchema = z.object({
  conversationId: recordIdSchema,
  messageId: recordIdSchema.optional(),
  reason: z.nativeEnum(ContentReportReason),
  details: z.string().trim().min(1).max(1_000).optional(),
});

const serviceErrorStatuses = {
  VALIDATION_ERROR: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * User-generated content safety for the human chat (App Store 1.2): report a
 * message or a conversation, and block / unblock the customer×business pair.
 * Participation is checked in the services; outsiders get a generic 404.
 */
export const moderationRouter = createTRPCRouter({
  report: protectedProcedure
    .input(reportSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reportConversationContent(ctx.db, {
          reporterId: ctx.session.user.id,
          ...input,
        });

        if (!result.ok) {
          return serviceFailure(result.code, "Report failed");
        }

        return ok(result.data, "Report received", 201);
      } catch (error) {
        return unexpectedFailure(error, "Report failed");
      }
    }),

  conversationBlock: protectedProcedure
    .input(conversationIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getConversationBlockState(ctx.db, {
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });

        if (!result.ok) {
          return serviceFailure(result.code, "Block state unavailable");
        }

        return ok(result.data, "Block state loaded");
      } catch (error) {
        return unexpectedFailure(error, "Block state unavailable");
      }
    }),

  block: protectedProcedure
    .input(conversationIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await blockConversation(ctx.db, {
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });

        if (!result.ok) {
          return serviceFailure(result.code, "Block failed");
        }

        return ok(result.data, "Conversation blocked");
      } catch (error) {
        return unexpectedFailure(error, "Block failed");
      }
    }),

  unblock: protectedProcedure
    .input(conversationIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await unblockConversation(ctx.db, {
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });

        if (!result.ok) {
          return serviceFailure(result.code, "Unblock failed");
        }

        return ok(result.data, "Conversation unblocked");
      } catch (error) {
        return unexpectedFailure(error, "Unblock failed");
      }
    }),
});
