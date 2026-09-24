import { getToolName, isToolUIPart } from "ai";

import type { OrbState } from "~/components/agents/loading-states/thinking-orb";
import type { AgentUIMessage } from "~/server/agent/home360-agent";

type AgentPart = AgentUIMessage["parts"][number];

export type AgentOrbState = Extract<
  OrbState,
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "composing"
  | "breathing"
>;

export type AgentActivityLabelKey =
  | "resting"
  | "solving"
  | "composing"
  | "connecting"
  | "querying"
  | "searching"
  | "creating"
  | "updating"
  | "deciding"
  | "working";

export type AgentActivity = {
  state: AgentOrbState;
  labelKey: AgentActivityLabelKey;
};

export const RESTING_ACTIVITY: AgentActivity = {
  state: "breathing",
  labelKey: "resting",
};
export const SOLVING_ACTIVITY: AgentActivity = {
  state: "solving",
  labelKey: "solving",
};
export const COMPOSING_ACTIVITY: AgentActivity = {
  state: "composing",
  labelKey: "composing",
};

/**
 * Tool-name prefix → orb choreography. Reads scan, writes work, decisions
 * (approve, reject, resolve, confirm) connect. Order matters: the first
 * matching prefix wins.
 */
const ACTIVITY_BY_PREFIX: Array<[string, AgentActivity]> = [
  ["list", { state: "searching", labelKey: "querying" }],
  ["get", { state: "searching", labelKey: "querying" }],
  ["preview", { state: "searching", labelKey: "querying" }],
  ["search", { state: "searching", labelKey: "searching" }],
  ["create", { state: "working", labelKey: "creating" }],
  ["submit", { state: "working", labelKey: "creating" }],
  ["request", { state: "working", labelKey: "creating" }],
  ["generate", { state: "working", labelKey: "creating" }],
  ["update", { state: "working", labelKey: "updating" }],
  ["adjust", { state: "working", labelKey: "updating" }],
  ["set", { state: "working", labelKey: "updating" }],
  ["assign", { state: "working", labelKey: "updating" }],
  ["resend", { state: "working", labelKey: "updating" }],
  ["respond", { state: "working", labelKey: "updating" }],
  ["deactivate", { state: "working", labelKey: "updating" }],
  ["reactivate", { state: "working", labelKey: "updating" }],
  ["withdraw", { state: "working", labelKey: "updating" }],
  ["approve", { state: "connecting", labelKey: "deciding" }],
  ["reject", { state: "connecting", labelKey: "deciding" }],
  ["accept", { state: "connecting", labelKey: "deciding" }],
  ["resolve", { state: "connecting", labelKey: "deciding" }],
  ["confirm", { state: "connecting", labelKey: "deciding" }],
  ["cancel", { state: "connecting", labelKey: "deciding" }],
  ["suspend", { state: "connecting", labelKey: "deciding" }],
  ["activate", { state: "connecting", labelKey: "deciding" }],
  ["open", { state: "connecting", labelKey: "deciding" }],
  ["pay", { state: "connecting", labelKey: "deciding" }],
];

const TERMINAL_TOOL_STATES = new Set([
  "output-available",
  "output-error",
  "output-denied",
]);

export function activityForTool(toolName: string): AgentActivity {
  for (const [prefix, activity] of ACTIVITY_BY_PREFIX) {
    if (toolName.startsWith(prefix)) {
      return activity;
    }
  }

  return { state: "working", labelKey: "working" };
}

export function deriveAgentActivity(
  parts: AgentPart[],
  streaming: boolean,
): AgentActivity {
  if (!streaming) {
    return RESTING_ACTIVITY;
  }

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];

    if (!part) {
      continue;
    }

    if (part.type === "text" && part.text.trim()) {
      return COMPOSING_ACTIVITY;
    }

    if (isToolUIPart(part)) {
      if (!TERMINAL_TOOL_STATES.has(part.state)) {
        return activityForTool(getToolName(part));
      }

      // A finished tool with no newer text: the model is reading the result.
      return SOLVING_ACTIVITY;
    }
  }

  return SOLVING_ACTIVITY;
}

export function deriveAgentOrbState(
  parts: AgentPart[],
  streaming: boolean,
): AgentOrbState {
  return deriveAgentActivity(parts, streaming).state;
}
