import type { JSONSchema7 } from "ai";
import { z } from "zod";

/**
 * Minimal Model Context Protocol surface over Streamable HTTP (stateless,
 * JSON responses): initialize, ping, tools/list and tools/call. Enough for
 * Claude Code, Claude Desktop and any spec-compliant MCP client.
 */
export const MCP_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

export const MCP_SERVER_INFO = { name: "home360", version: "1.0.0" } as const;

const requestIdSchema = z.union([z.string(), z.number()]);

export const jsonRpcMessageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: requestIdSchema.optional(),
  method: z.string().min(1),
  params: z.record(z.unknown()).optional(),
});

export type JsonRpcMessage = z.infer<typeof jsonRpcMessageSchema>;
export type JsonRpcId = z.infer<typeof requestIdSchema>;

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId | null; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId | null;
      error: { code: number; message: string };
    };

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export const toolCallParamsSchema = z.object({
  name: z.string().min(1).max(100),
  arguments: z.record(z.unknown()).optional(),
});

export type McpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
};

export type McpToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
};

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSIONS[0];
}
