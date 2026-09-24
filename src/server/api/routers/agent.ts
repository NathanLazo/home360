import { TRPCError } from "@trpc/server";
import type { Prisma } from "@generated/prisma";
import { z } from "zod";

import { agentAreaForRole, type AgentArea } from "~/lib/agent/agent-area";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createAgentConversation,
  deleteAgentConversation,
  getAgentConversation,
  listAgentConversations,
  updateAgentConversation,
  type AgentConversationDetail,
  type AgentConversationSummary,
} from "~/server/services/agent/conversations";

const conversationIdSchema = z.object({ id: z.string().cuid() });

const titleSchema = z.string().trim().min(1).max(120);

/**
 * A UI message snapshot. Parts are validated by the AI SDK on the chat route;
 * here they are opaque JSON so persistence never rejects a new part type.
 */
const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.unknown()),
  metadata: z.unknown().optional(),
});

const messagesSchema = z.array(uiMessageSchema).min(1).max(500);

const createSchema = z.object({
  title: titleSchema,
  messages: messagesSchema,
});

const updateSchema = z
  .object({
    id: z.string().cuid(),
    title: titleSchema.optional(),
    messages: messagesSchema.optional(),
  })
  .refine(
    (input) => input.title !== undefined || input.messages !== undefined,
    {
      message: "Nothing to update",
    },
  );

/**
 * Same guard as the chat route: only roles that own a panel reach the
 * assistant. Impersonated sessions still list and read threads; writes are
 * refused upstream by `protectedProcedure`.
 */
const agentProcedure = protectedProcedure.use(({ ctx, next }) => {
  const area = agentAreaForRole(ctx.session.user.role);

  if (!area) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({
    ctx: { ...ctx, agent: { area, userId: ctx.session.user.id } },
  });
});

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

function asJson(
  messages: z.infer<typeof messagesSchema>,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(messages)) as Prisma.InputJsonValue;
}

export const agentRouter = createTRPCRouter({
  getArea: agentProcedure.query(
    async ({
      ctx,
    }): Promise<TrpcResponse<{ area: AgentArea; readOnly: boolean }>> =>
      ok(
        {
          area: ctx.agent.area,
          readOnly: ctx.session.user.impersonator !== null,
        },
        "Agent area resolved",
      ),
  ),

  listConversations: agentProcedure.query(
    async ({ ctx }): Promise<TrpcResponse<AgentConversationSummary[]>> => {
      try {
        const conversations = await listAgentConversations(ctx.db, ctx.agent);
        return ok(conversations, "Conversations retrieved");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to list conversations");
      }
    },
  ),

  getConversation: agentProcedure
    .input(conversationIdSchema)
    .query(
      async ({
        ctx,
        input,
      }): Promise<TrpcResponse<AgentConversationDetail>> => {
        try {
          const result = await getAgentConversation(
            ctx.db,
            ctx.agent,
            input.id,
          );

          if (!result.ok) {
            return fail("NOT_FOUND", 404, "Conversation not found");
          }

          return ok(result.data, "Conversation retrieved");
        } catch (error: unknown) {
          return unexpectedFailure(error, "Unable to load the conversation");
        }
      },
    ),

  createConversation: agentProcedure
    .input(createSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<TrpcResponse<AgentConversationSummary>> => {
        try {
          const conversation = await createAgentConversation(
            ctx.db,
            ctx.agent,
            {
              title: input.title,
              messages: asJson(input.messages),
            },
          );
          return ok(conversation, "Conversation created", 201);
        } catch (error: unknown) {
          return unexpectedFailure(error, "Unable to save the conversation");
        }
      },
    ),

  updateConversation: agentProcedure
    .input(updateSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<TrpcResponse<AgentConversationSummary>> => {
        try {
          const result = await updateAgentConversation(ctx.db, ctx.agent, {
            id: input.id,
            title: input.title,
            messages: input.messages ? asJson(input.messages) : undefined,
          });

          if (!result.ok) {
            return fail("NOT_FOUND", 404, "Conversation not found");
          }

          return ok(result.data, "Conversation updated");
        } catch (error: unknown) {
          return unexpectedFailure(error, "Unable to update the conversation");
        }
      },
    ),

  deleteConversation: agentProcedure
    .input(conversationIdSchema)
    .mutation(async ({ ctx, input }): Promise<TrpcResponse<{ id: string }>> => {
      try {
        const result = await deleteAgentConversation(
          ctx.db,
          ctx.agent,
          input.id,
        );

        if (!result.ok) {
          return fail("NOT_FOUND", 404, "Conversation not found");
        }

        return ok(result.data, "Conversation deleted");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to delete the conversation");
      }
    }),
});
