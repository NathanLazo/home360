/**
 * Model catalog for the HOME360 assistant. Ids are Vercel AI Gateway strings
 * (`provider/model`), so no provider SDK is imported anywhere. Shared by the
 * client (model picker) and the server (allow-list on the chat route).
 */
export type AgentModelOption = {
  id: string;
  label: string;
  contextWindow: number;
};

export const AGENT_MODELS = [
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    contextWindow: 200_000,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    contextWindow: 200_000,
  },
] as const satisfies readonly AgentModelOption[];

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

export const DEFAULT_AGENT_MODEL_ID: AgentModelId = "anthropic/claude-sonnet-5";

export function isAgentModelId(value: string): value is AgentModelId {
  return AGENT_MODELS.some((model) => model.id === value);
}

export function getAgentModel(id: AgentModelId): AgentModelOption {
  return AGENT_MODELS.find((model) => model.id === id) ?? AGENT_MODELS[0];
}
