import { NextResponse } from "next/server";

import { db } from "~/server/db";
import {
  JSON_RPC_ERRORS,
  jsonRpcMessageSchema,
  rpcError,
  type JsonRpcResponse,
} from "~/server/mcp/mcp-protocol";
import { handleMcpMessage } from "~/server/mcp/mcp-server";
import { resolveMcpToken } from "~/server/services/mcp/mcp-tokens";

/** Spreadsheet imports and Stripe calls can take a while. */
export const maxDuration = 60;

const BEARER_PREFIX = "Bearer ";
const MAX_BATCH = 20;

function unauthorized(): NextResponse {
  return NextResponse.json(
    rpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, "Unauthorized"),
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="home360-mcp"' },
    },
  );
}

/**
 * HOME360 MCP endpoint (Streamable HTTP, stateless, JSON responses). Auth is
 * a personal token from Profile → "Conectar con Claude Code"; the tool
 * catalog is the assistant catalog of the token owner's role.
 */
export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return unauthorized();
  }

  const principal = await resolveMcpToken(
    db,
    authorization.slice(BEARER_PREFIX.length).trim(),
  );

  if (!principal) {
    return unauthorized();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      rpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, "Parse error"),
      { status: 400 },
    );
  }

  const batch = Array.isArray(body);
  const items: unknown[] = (Array.isArray(body) ? body : [body]).slice(
    0,
    MAX_BATCH,
  );
  const responses: JsonRpcResponse[] = [];

  for (const item of items) {
    const parsed = jsonRpcMessageSchema.safeParse(item);

    if (!parsed.success) {
      responses.push(
        rpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, "Invalid request"),
      );
      continue;
    }

    try {
      const response = await handleMcpMessage(
        principal,
        parsed.data,
        request.headers,
      );

      if (response) {
        responses.push(response);
      }
    } catch {
      responses.push(
        rpcError(
          parsed.data.id ?? null,
          JSON_RPC_ERRORS.INTERNAL_ERROR,
          "Internal error",
        ),
      );
    }
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(batch ? responses : responses[0]);
}

/** No server-initiated stream: this server only answers requests. */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
