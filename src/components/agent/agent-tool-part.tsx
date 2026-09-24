"use client";

import {
  getToolName,
  isToolUIPart,
  type UIDataTypes,
  type UIMessagePart,
  type UITools,
} from "ai";
import { useTranslations } from "next-intl";

import {
  ToolChips,
  type ToolChipCall,
  type ToolChipStatus,
} from "~/components/agents/tool-chips";

type ToolEnvelope = { error: string | null; status: number; message: string };

function isToolEnvelope(value: unknown): value is ToolEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "message" in value &&
    "error" in value
  );
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

const MAX_RESULT_CHARS = 600;

function truncate(text: string): string {
  return text.length <= MAX_RESULT_CHARS
    ? text
    : `${text.slice(0, MAX_RESULT_CHARS)}…`;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * One chip per tool call, grouped in a row. The detail panel shows the
 * arguments and either the envelope error code (translated when known), the
 * envelope message or a trimmed JSON of the result.
 */
export function AgentToolChips({
  parts,
}: {
  parts: UIMessagePart<UIDataTypes, UITools>[];
}) {
  const t = useTranslations("agent");
  const errors = useTranslations("errors");

  const toChipCall = (
    part: UIMessagePart<UIDataTypes, UITools>,
    index: number,
  ): ToolChipCall | null => {
    if (!isToolUIPart(part)) {
      return null;
    }

    const toolName = getToolName(part);
    const name = t.has(`tools.${toolName}`) ? t(`tools.${toolName}`) : toolName;
    const args = toRecord(part.input);
    let status: ToolChipStatus = "running";
    let result: string | undefined;

    if (part.state === "output-available") {
      const envelope = isToolEnvelope(part.output) ? part.output : null;
      const failedError = envelope?.error ?? null;
      status = failedError === null ? "success" : "error";

      if (failedError !== null) {
        result = errors.has(failedError) ? errors(failedError) : failedError;
      } else {
        result = envelope?.message ?? truncate(formatJson(part.output));
      }
    } else if (part.state === "output-error") {
      status = "error";
      result = part.errorText ?? t("toolFailed");
    } else if (part.state === "output-denied") {
      status = "cancelled";
      result = t("toolDenied");
    }

    return {
      id: part.toolCallId ?? `tool-${index}`,
      name,
      args,
      result,
      status,
    };
  };

  const calls = parts
    .map(toChipCall)
    .filter((call): call is ToolChipCall => call !== null);

  if (calls.length === 0) {
    return null;
  }

  return (
    <ToolChips
      calls={calls}
      runningLabel={t("toolRunning")}
      className="max-w-full"
    />
  );
}
