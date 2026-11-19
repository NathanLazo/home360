/** Mirror of `FINAL_CHARGE_MAX_CENTS` on the server (10 M MXN). */
const FINAL_CHARGE_MAX_CENTS = 1_000_000_000;

/** Typed pesos → integer cents; `null` when empty, invalid or out of range. */
export function parsePesosToCents(value: string): number | null {
  const pesos = Number(value);

  if (value.trim() === "" || !Number.isFinite(pesos) || pesos <= 0) {
    return null;
  }

  const cents = Math.round(pesos * 100);

  return cents <= FINAL_CHARGE_MAX_CENTS ? cents : null;
}

/** Preview of the server rule in `diagnostic-final-charge.ts`. */
export function finalChargeBreakdown(input: {
  finalCents: number;
  diagnosticCents: number;
  credited: boolean;
}): { creditCents: number; customerPaysCents: number } {
  const creditCents = input.credited ? input.diagnosticCents : 0;

  return {
    creditCents,
    customerPaysCents: input.finalCents - creditCents,
  };
}
