/**
 * Model catalog for the HOME360 assistant. Ids are Vercel AI Gateway strings
 * (`provider/model`), so no provider SDK is imported anywhere. Shared by the
 * client (model picker, profile) and the server (allow-list on the chat route,
 * usage pricing).
 *
 * Prices are the gateway list prices in USD per million tokens, verified on
 * 2026-09-23 against `https://ai-gateway.vercel.sh/v1/models`. The platform
 * price applied to tenants is derived in `agent-pricing.ts` (owner decision:
 * gateway price × 2; `free` models are absorbed by the platform).
 */
export type AgentModelTier = "free" | "low" | "high";

export type AgentModelOption = {
  id: string;
  label: string;
  contextWindow: number;
  /** Badge shown in the picker and the profile: consumption tier. */
  tier: AgentModelTier;
  /** True while the owner keeps the model free ("gratis por lo pronto"). */
  free: boolean;
  /** Whether the gateway advertises tool use (the agent needs it). */
  supportsTools: boolean;
  /** Gateway list price, USD per million tokens. */
  gatewayPricing: {
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
  };
};

export const AGENT_MODELS = [
  {
    id: "spacexai/grok-4.7",
    label: "Grok 4.7",
    contextWindow: 500_000,
    tier: "high",
    free: false,
    supportsTools: true,
    gatewayPricing: { inputUsdPerMillion: 1.2, outputUsdPerMillion: 3.6 },
  },
  {
    id: "openai/gpt-6-luna",
    label: "GPT-6 Luna",
    contextWindow: 1_050_000,
    tier: "low",
    free: false,
    supportsTools: true,
    gatewayPricing: { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 },
  },
  {
    id: "typesafe-ai/jev",
    label: "Jev",
    contextWindow: 32_000,
    tier: "free",
    free: true,
    // The gateway lists Jev as an evaluation model without tool use; it is
    // kept in the catalog by owner decision and flagged in F8-05.
    supportsTools: false,
    gatewayPricing: { inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 },
  },
] as const satisfies readonly AgentModelOption[];

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

export const DEFAULT_AGENT_MODEL_ID: AgentModelId = "spacexai/grok-4.7";

export function isAgentModelId(value: string): value is AgentModelId {
  return AGENT_MODELS.some((model) => model.id === value);
}

export function getAgentModel(id: AgentModelId): AgentModelOption {
  return AGENT_MODELS.find((model) => model.id === id) ?? AGENT_MODELS[0];
}
