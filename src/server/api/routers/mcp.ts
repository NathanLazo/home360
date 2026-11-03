import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { panelAreaForRole } from "~/lib/agent/agent-area";
import { recordIdSchema } from "~/schemas/record-id.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
  type CreatedMcpToken,
  type McpTokenItem,
} from "~/server/services/mcp/mcp-tokens";

/**
 * Personal MCP connections (Claude Code and other MCP clients). Panel roles
 * only; under impersonation `protectedProcedure` refuses the mutations, so
 * an admin can never mint a token for the impersonated user.
 */
const mcpProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!panelAreaForRole(ctx.session.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, userId: ctx.session.user.id } });
});

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export type McpConnectionList = {
  /** Endpoint the MCP client connects to (Streamable HTTP). */
  endpoint: string;
  tokens: McpTokenItem[];
};

export const mcpRouter = createTRPCRouter({
  listTokens: mcpProcedure.query(
    async ({ ctx }): Promise<TrpcResponse<McpConnectionList>> => {
      try {
        const tokens = await listMcpTokens(ctx.db, ctx.userId);
        return ok(
          { endpoint: new URL("/api/mcp", env.APP_URL).toString(), tokens },
          "MCP connections loaded",
        );
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to load MCP connections");
      }
    },
  ),

  createToken: mcpProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60) }).strict())
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<TrpcResponse<CreatedMcpToken, "MCP_TOKEN_LIMIT_REACHED">> => {
        try {
          const created = await createMcpToken(ctx.db, {
            userId: ctx.userId,
            name: input.name,
          });

          if (!created.ok) {
            return fail<never, "MCP_TOKEN_LIMIT_REACHED">(
              created.code,
              409,
              "MCP connection limit reached",
            );
          }

          return ok(created.data, "MCP connection created", 201);
        } catch (error: unknown) {
          const normalized = normalizeError(error);
          return fail<never, "MCP_TOKEN_LIMIT_REACHED">(
            normalized.code,
            normalized.status,
            "Unable to create the MCP connection",
          );
        }
      },
    ),

  revokeToken: mcpProcedure
    .input(z.object({ id: recordIdSchema }).strict())
    .mutation(async ({ ctx, input }): Promise<TrpcResponse<{ id: string }>> => {
      try {
        const revoked = await revokeMcpToken(ctx.db, {
          userId: ctx.userId,
          id: input.id,
        });

        if (!revoked.ok) {
          return fail("NOT_FOUND", 404, "MCP connection not found");
        }

        return ok(revoked.data, "MCP connection revoked");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to revoke the MCP connection");
      }
    }),
});
