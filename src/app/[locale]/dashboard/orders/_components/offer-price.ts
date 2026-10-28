/** AI price range of a request, in cents; null when the diagnosis has none. */
export type AiPriceRange = { minCents: number; maxCents: number };

export type PriceSuggestionKind = "service" | "min" | "mid" | "max";

export type PriceSuggestion = { kind: PriceSuggestionKind; cents: number };

/** Typed price far outside the AI range: likely a typo (extra/missing 0). */
export type PriceWarning = "tooHigh" | "tooLow";

const PRICE_STEP_CENTS = 1_000;
const OFF_RANGE_FACTOR = 3;

function roundToStep(cents: number): number {
  return Math.max(
    PRICE_STEP_CENTS,
    Math.round(cents / PRICE_STEP_CENTS) * PRICE_STEP_CENTS,
  );
}

export function toAiPriceRange(
  minCents: number | null,
  maxCents: number | null,
): AiPriceRange | null {
  if (minCents === null || maxCents === null || maxCents <= 0) return null;
  return { minCents, maxCents };
}

/**
 * One-tap prices: the catalog price (when the draft came from a service)
 * plus the AI range low / mid / high, deduplicated and ascending.
 */
export function priceSuggestions(input: {
  range: AiPriceRange | null;
  serviceCents: number | null;
}): PriceSuggestion[] {
  const candidates: PriceSuggestion[] = [];

  if (input.serviceCents !== null) {
    candidates.push({ kind: "service", cents: input.serviceCents });
  }

  if (input.range) {
    const { minCents, maxCents } = input.range;
    candidates.push(
      { kind: "min", cents: roundToStep(minCents) },
      { kind: "mid", cents: roundToStep((minCents + maxCents) / 2) },
      { kind: "max", cents: roundToStep(maxCents) },
    );
  }

  const seen = new Set<number>();

  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.cents)) return false;
      seen.add(candidate.cents);
      return true;
    })
    .sort((a, b) => a.cents - b.cents);
}

/** Soft, non-blocking check: the business may still send any price. */
export function priceWarning(
  cents: number | null,
  range: AiPriceRange | null,
): PriceWarning | null {
  if (cents === null || cents <= 0 || range === null) return null;
  if (cents > range.maxCents * OFF_RANGE_FACTOR) return "tooHigh";
  if (cents * OFF_RANGE_FACTOR < range.minCents) return "tooLow";
  return null;
}

/** Form text (pesos) → cents; null for empty or invalid input. */
export function pesosToCents(value: string): number | null {
  const amount = Number(value);
  return value.trim() === "" || !Number.isFinite(amount) || amount <= 0
    ? null
    : Math.round(amount * 100);
}

/** Cents → form text (pesos) without trailing ".00". */
export function centsToPesos(cents: number): string {
  return String(cents / 100);
}
