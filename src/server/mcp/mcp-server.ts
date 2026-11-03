import "server-only";

import type { Session } from "next-auth";

import { buildMcpInstructions } from "~/server/agent/agent-instructions";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";
import type { McpPrincipal } from "~/server/services/mcp/mcp-tokens";
import {
  JSON_RPC_ERRORS,
  MCP_SERVER_INFO,
  negotiateProtocolVersion,
  rpcError,
  rpcResult,
  toolCallParamsSchema,
  type JsonRpcMessage,
  type JsonRpcResponse,
} from "./mcp-protocol";
import {
  buildMcpToolSet,
  callMcpTool,
  describeMcpTools,
  resolveMcpAttachments,
} from "./mcp-tools";

/** Session shape the tRPC guards expect, minted for a verified token. */
function principalSession(principal: McpPrincipal): Session {
  return {
    user: {
      id: principal.userId,
      role: principal.role,
      name: principal.name,
      authInvalidated: false,
      impersonator: null,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function tenantName(principal: McpPrincipal): Promise<string | null> {
  switch (principal.area) {
    case "business":
      return (
        (
          await db.business.findUnique({
            where: { ownerId: principal.userId },
            select: { name: true },
          })
        )?.name ?? null
      );
    case "corporate":
      return (
        (
          await db.corporateAccount.findUnique({
            where: { ownerId: principal.userId },
            select: { name: true },
          })
        )?.name ?? null
      );
    case "admin":
      return null;
  }
}

/**
 * One JSON-RPC message → its response, or `null` for notifications. Tool
 * calls re-enter tRPC through a caller bound to the token's user, so RBAC,
 * tenant scoping and plan limits are exactly the panel's.
 */
export async function handleMcpMessage(
  principal: McpPrincipal,
  message: JsonRpcMessage,
  headers: Headers,
): Promise<JsonRpcResponse | null> {
  if (message.id === undefined) {
    return null;
  }

  const id = message.id;
  const caller = createCaller({
    db,
    session: principalSession(principal),
    headers,
  });

  switch (message.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: negotiateProtocolVersion(
          message.params?.protocolVersion,
        ),
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions: buildMcpInstructions(principal.area, {
          userName: principal.name,
          tenantName: await tenantName(principal),
        }),
      });

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: await describeMcpTools(buildMcpToolSet(principal, caller)),
      });

    case "tools/call": {
      const params = toolCallParamsSchema.safeParse(message.params);

      if (!params.success) {
        return rpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, "Invalid params");
      }

      const args = params.data.arguments ?? {};
      const tools = buildMcpToolSet(
        principal,
        caller,
        await resolveMcpAttachments(principal, args),
      );
      const result = await callMcpTool(tools, params.data.name, args);

      return result
        ? rpcResult(id, result)
        : rpcError(
            id,
            JSON_RPC_ERRORS.INVALID_PARAMS,
            `Unknown tool: ${params.data.name}`,
          );
    }

    default:
      return rpcError(
        id,
        JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        `Method not found: ${message.method}`,
      );
  }
}
