import type { ModelMessage, ToolResultPart, UserContent } from "ai";

/**
 * Context budget of one model call, in serialized characters (~4 chars per
 * token). It stays well under the smallest catalog window (262k tokens) so a
 * 20-step turn with trimmed tool results never overflows the prompt.
 */
const MAX_CONTEXT_CHARS = 360_000;

/** Tool results of past turns keep only a preview of this size. */
const PAST_TOOL_RESULT_CHARS = 1_500;

/** Tool results of the current turn, when the turn itself runs over budget. */
const CURRENT_TOOL_RESULT_CHARS = 4_000;

/** The latest tool messages of the turn are never compacted. */
const KEEP_RECENT_TOOL_MESSAGES = 2;

function sizeOf(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function compactToolResult(
  part: ToolResultPart,
  maxChars: number,
): ToolResultPart {
  const { output } = part;

  if (
    output.type !== "json" &&
    output.type !== "text" &&
    output.type !== "error-json" &&
    output.type !== "error-text"
  ) {
    return part;
  }

  const serialized =
    typeof output.value === "string"
      ? output.value
      : JSON.stringify(output.value);

  if (serialized.length <= maxChars) {
    return part;
  }

  return {
    ...part,
    output: {
      type: "text",
      value: `${serialized.slice(0, maxChars)}… [compacted: older tool result, ${serialized.length} chars. Call the tool again if you need the full data.]`,
    },
  };
}

function compactToolMessage(
  message: ModelMessage,
  maxChars: number,
): ModelMessage {
  if (message.role !== "tool") {
    return message;
  }

  return {
    ...message,
    content: message.content.map((part) =>
      part.type === "tool-result" ? compactToolResult(part, maxChars) : part,
    ),
  };
}

/**
 * Files of past turns already did their job for the model; their bytes stay
 * available to the receipt tools through the attachment store (filename).
 */
function stripPastFiles(message: ModelMessage): ModelMessage {
  if (message.role !== "user" || typeof message.content === "string") {
    return message;
  }

  const content: UserContent = message.content.map((part) =>
    part.type === "file"
      ? {
          type: "text" as const,
          text: `[Attached file "${part.filename ?? "unnamed"}" (${part.mediaType}); tools can use it by filename.]`,
        }
      : part,
  );

  return { ...message, content };
}

function lastUserIndex(messages: readonly ModelMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return -1;
}

/**
 * Keeps the prompt of every agent step inside the budget:
 *
 * 1. Past turns: tool results shrink to a preview and attached files become a
 *    short note (the base64 would otherwise travel on every turn).
 * 2. Current turn over budget: older tool results of this turn shrink too,
 *    keeping the latest ones intact.
 * 3. Still over budget: the oldest turns are dropped whole, always cutting at
 *    a user message so tool calls never lose their results.
 */
export function compactAgentMessages(
  messages: readonly ModelMessage[],
): ModelMessage[] {
  const currentTurnStart = lastUserIndex(messages);

  let compacted = messages.map((message, index) =>
    index < currentTurnStart
      ? stripPastFiles(compactToolMessage(message, PAST_TOOL_RESULT_CHARS))
      : message,
  );

  if (sizeOf(compacted) <= MAX_CONTEXT_CHARS) {
    return compacted;
  }

  const toolIndexes = compacted
    .map((message, index) => (message.role === "tool" ? index : -1))
    .filter((index) => index > currentTurnStart);
  const protectedIndexes = new Set(
    toolIndexes.slice(-KEEP_RECENT_TOOL_MESSAGES),
  );

  compacted = compacted.map((message, index) =>
    index > currentTurnStart && !protectedIndexes.has(index)
      ? compactToolMessage(message, CURRENT_TOOL_RESULT_CHARS)
      : message,
  );

  while (sizeOf(compacted) > MAX_CONTEXT_CHARS) {
    const nextUser = compacted.findIndex(
      (message, index) => index > 0 && message.role === "user",
    );

    // The current turn is never dropped: once it is all that is left, stop.
    if (nextUser <= 0) {
      break;
    }

    compacted = compacted.slice(nextUser);
  }

  return compacted;
}
