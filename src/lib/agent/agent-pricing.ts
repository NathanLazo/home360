import {
  getAgentModel,
  type AgentModelId,
  type AgentModelOption,
} from "./agent-models";

/**
 * Pricing rules of the assistant (owner decision, 2026-09-23):
 *
 * - The platform price is the gateway price multiplied by `AI_PRICE_MARKUP`.
 * - Free models cost the tenant nothing; the platform absorbs the gateway fee.
 * - Tenants pay from a prepaid wallet only (no postpaid invoicing). Every
 *   tenant receives `AI_WELCOME_CREDIT_USD_MICROS` once, to try the assistant.
 *
 * Money in this module is USD in micro-dollars (1 USD = 1 000 000 micros):
 * token prices are quoted per million tokens, so one token at
 * `X USD / M` costs exactly `X` micro-dollars and no rounding happens per
 * token. Wallet balances are integers of the same unit.
 */
export const AI_PRICE_MARKUP = 2;

export const USD_MICROS_PER_USD = 1_000_000;

/** 3 USD granted once to every tenant. */
export const AI_WELCOME_CREDIT_USD_MICROS = 3 * USD_MICROS_PER_USD;

/** Wallet ceiling so the integer column never approaches its limit. */
export const AI_WALLET_MAX_USD_MICROS = 1_000 * USD_MICROS_PER_USD;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type PlatformModelPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

/** Price the tenant pays, USD per million tokens (0 for free models). */
export function platformPricePerMillion(
  model: AgentModelOption,
): PlatformModelPricing {
  if (model.free) {
    return { inputUsdPerMillion: 0, outputUsdPerMillion: 0 };
  }

  return {
    inputUsdPerMillion: model.gatewayPricing.inputUsdPerMillion * AI_PRICE_MARKUP,
    outputUsdPerMillion:
      model.gatewayPricing.outputUsdPerMillion * AI_PRICE_MARKUP,
  };
}

/**
 * Cost of one turn in USD micros at the platform price. Tokens are integers
 * and prices have at most three decimals, so the product is rounded once.
 */
export function turnCostUsdMicros(
  modelId: AgentModelId,
  usage: TokenUsage,
): number {
  const pricing = platformPricePerMillion(getAgentModel(modelId));
  const input = Math.max(0, Math.floor(usage.inputTokens));
  const output = Math.max(0, Math.floor(usage.outputTokens));

  return Math.round(
    input * pricing.inputUsdPerMillion + output * pricing.outputUsdPerMillion,
  );
}

/** What the gateway bills the platform for the same turn (for margins). */
export function gatewayCostUsdMicros(
  modelId: AgentModelId,
  usage: TokenUsage,
): number {
  const { gatewayPricing } = getAgentModel(modelId);
  const input = Math.max(0, Math.floor(usage.inputTokens));
  const output = Math.max(0, Math.floor(usage.outputTokens));

  return Math.round(
    input * gatewayPricing.inputUsdPerMillion +
      output * gatewayPricing.outputUsdPerMillion,
  );
}

export function usdMicrosToUsd(micros: number): number {
  return micros / USD_MICROS_PER_USD;
}

/** Formats a micro-dollar amount as USD with cent precision. */
export function formatUsdMicros(micros: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: micros !== 0 && Math.abs(micros) < 10_000 ? 4 : 2,
  }).format(usdMicrosToUsd(micros));
}

/** Compact token count: `950`, `12.4k`, `1.2M`. */
export function formatTokenCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}
