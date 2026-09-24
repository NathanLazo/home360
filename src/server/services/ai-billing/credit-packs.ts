import { USD_MICROS_PER_USD } from "~/lib/agent/agent-pricing";

/**
 * Prepaid token packs (owner decision F8-05, D3: no bonus tokens, the pack
 * credits exactly what it costs). Prices in USD cents because the wallet and
 * the token prices are quoted in USD; Stripe Checkout charges in USD.
 */
export const AI_CREDIT_PACKS = [
  { code: "S", amountUsdCents: 500 },
  { code: "M", amountUsdCents: 1_000 },
  { code: "L", amountUsdCents: 2_500 },
] as const;

export type AiCreditPackCode = (typeof AI_CREDIT_PACKS)[number]["code"];

export type AiCreditPack = {
  code: AiCreditPackCode;
  amountUsdCents: number;
  creditUsdMicros: number;
};

export function isAiCreditPackCode(value: string): value is AiCreditPackCode {
  return AI_CREDIT_PACKS.some((pack) => pack.code === value);
}

export function getAiCreditPack(code: AiCreditPackCode): AiCreditPack {
  const pack =
    AI_CREDIT_PACKS.find((candidate) => candidate.code === code) ??
    AI_CREDIT_PACKS[0];

  return {
    code: pack.code,
    amountUsdCents: pack.amountUsdCents,
    creditUsdMicros: (pack.amountUsdCents * USD_MICROS_PER_USD) / 100,
  };
}

export function listAiCreditPacks(): AiCreditPack[] {
  return AI_CREDIT_PACKS.map((pack) => getAiCreditPack(pack.code));
}
