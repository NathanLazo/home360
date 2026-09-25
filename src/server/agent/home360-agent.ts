import { isStepCount, ToolLoopAgent, type UIMessage } from "ai";

import { env } from "~/env";
import type { AgentArea } from "~/lib/agent/agent-area";
import {
  DEFAULT_AGENT_MODEL_ID,
  isAgentModelId,
  type AgentModelId,
} from "~/lib/agent/agent-models";
import {
  EMPTY_ATTACHMENT_STORE,
  type AgentAttachmentStore,
} from "./agent-attachments";
import {
  buildAgentInstructions,
  type AgentPromptContext,
} from "./agent-instructions";
import { createAgentTools } from "./tool-catalog";
import type { AgentCaller } from "./tool-runtime";

/** Hard cap on tool round-trips per turn (same budget Inerpy ships). */
const MAX_STEPS = 20;

/** Default model: `AGENT_MODEL` when it names a catalog entry, else Sonnet. */
export const AGENT_MODEL: AgentModelId =
  env.AGENT_MODEL && isAgentModelId(env.AGENT_MODEL)
    ? env.AGENT_MODEL
    : DEFAULT_AGENT_MODEL_ID;

export type CreateHome360AgentInput = {
  area: AgentArea;
  caller: AgentCaller;
  context: AgentPromptContext;
  model?: AgentModelId;
  /** Files attached in the conversation, resolvable by tools via filename. */
  attachments?: AgentAttachmentStore;
};

export function createHome360Agent({
  area,
  caller,
  context,
  model = AGENT_MODEL,
  attachments = EMPTY_ATTACHMENT_STORE,
}: CreateHome360AgentInput) {
  return new ToolLoopAgent({
    model,
    instructions: buildAgentInstructions(context),
    tools: createAgentTools(area, caller, attachments),
    stopWhen: isStepCount(MAX_STEPS),
  });
}

export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AgentMessageMetadata = {
  usage?: AgentUsage;
};

/**
 * Generic UI message: the tool union is deliberately not inferred (three
 * catalogs with ~130 tools make `InferAgentUIMessage` explode), the client
 * narrows parts with `isToolUIPart` / `getToolName` instead.
 */
export type AgentUIMessage = UIMessage<AgentMessageMetadata>;
