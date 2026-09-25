import { TRPCError } from "@trpc/server";

import type { createCaller } from "~/server/api/root";

/** Server-side tRPC caller the agent tools delegate to (RBAC lives there). */
export type AgentCaller = ReturnType<typeof createCaller>;

const TRPC_CODE_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/**
 * Failure envelope returned to the model. It mirrors `TrpcResponse` so the
 * prompt can teach one shape: `error` is a stable code, `message` is short
 * reference text. Provider errors, stacks and SQL never travel here.
 */
export type AgentToolFailure = {
  result: null;
  error: string;
  status: number;
  message: string;
};

export function toToolFailure(error: unknown): AgentToolFailure {
  if (error instanceof TRPCError) {
    return {
      result: null,
      error:
        error.message === "IMPERSONATION_READ_ONLY"
          ? "IMPERSONATION_READ_ONLY"
          : error.code,
      status: TRPC_CODE_STATUS[error.code] ?? 500,
      message: error.message,
    };
  }

  return {
    result: null,
    error: "INTERNAL_ERROR",
    status: 500,
    message: error instanceof Error ? error.message : "Unexpected tool failure",
  };
}

/**
 * One tool result may take ~4k tokens: 20 steps of them still fit the
 * context budget of `agent-context.ts` next to the conversation.
 */
const MAX_TOOL_CHARS = 16_000;
const MAX_STRING_CHARS = 500;

function hasToJson(value: object): value is { toJSON: () => unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

function shrinkValue(value: unknown, arrayCap: number): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING_CHARS
      ? `${value.slice(0, MAX_STRING_CHARS)}…`
      : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, arrayCap).map((item) => shrinkValue(item, arrayCap));
  }

  if (typeof value === "object" && value !== null) {
    // Dates and Decimals serialize themselves; do not walk into them.
    if (hasToJson(value)) {
      return value;
    }

    const out: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(value)) {
      out[key] = shrinkValue(raw, arrayCap);
    }

    return out;
  }

  return value;
}

/**
 * Keeps a tool result inside the model budget. Lists are capped step by step
 * and the model is told the result was trimmed so it asks for filters instead
 * of paginating blindly.
 */
export function maybeTruncateToolResult(value: unknown): unknown {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    return value;
  }

  if (serialized.length <= MAX_TOOL_CHARS) {
    return value;
  }

  for (const arrayCap of [20, 10, 5, 3]) {
    const shrunk = shrinkValue(value, arrayCap);
    let shrunkSerialized: string;

    try {
      shrunkSerialized = JSON.stringify(shrunk);
    } catch {
      break;
    }

    if (shrunkSerialized.length <= MAX_TOOL_CHARS) {
      if (
        shrunk !== null &&
        typeof shrunk === "object" &&
        !Array.isArray(shrunk)
      ) {
        return {
          ...(shrunk as Record<string, unknown>),
          _truncated: `Result trimmed: every list was capped to ${arrayCap} items to fit the chat. Use filters or the cursor if you need the rest.`,
        };
      }

      return shrunk;
    }
  }

  return {
    result: null,
    error: "PAYLOAD_TOO_LARGE",
    status: 413,
    message:
      "The tool result is too large for the chat even after trimming. Use filters, a narrower date range or a summary tool.",
  } satisfies AgentToolFailure;
}

/** Every tool goes through here: it never throws and never leaks internals. */
export async function runTool(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return maybeTruncateToolResult(await operation());
  } catch (error: unknown) {
    return toToolFailure(error);
  }
}

export function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}
