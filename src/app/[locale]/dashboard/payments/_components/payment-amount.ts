/**
 * Money entered by hand arrives as a decimal string in pesos. It is converted
 * to integer cents here and nowhere else.
 *
 * The conversion never multiplies a fractional number: `19.99 * 100` is
 * `1998.9999999999998` in IEEE-754 and would silently under-charge. Splitting
 * the string and scaling the integer part keeps every value exact.
 */
const PESOS_PATTERN = /^\d{1,9}(?:\.\d{1,2})?$/;

const CENTS_PER_PESO = 100;

export function parsePesosToCents(value: string): number | null {
  // A comma is what a Spanish keyboard produces for the decimal separator.
  const normalized = value.trim().replace(",", ".");

  if (!PESOS_PATTERN.test(normalized)) {
    return null;
  }

  const [wholePart = "0", fractionPart = ""] = normalized.split(".");
  const cents =
    Number(wholePart) * CENTS_PER_PESO + Number(fractionPart.padEnd(2, "0"));

  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Renders integer cents back into the decimal string the input expects. */
export function formatCentsAsPesosInput(cents: number): string {
  const whole = Math.trunc(cents / CENTS_PER_PESO);
  const fraction = Math.abs(cents % CENTS_PER_PESO);

  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
