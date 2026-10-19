/** D10-2 pickup codes: 10 characters of the RFC 4648 base32 alphabet. */
export const PICKUP_CODE_LENGTH = 10;

const PICKUP_CODE_PATTERN = /^[A-Z2-7]{10}$/;

/**
 * Canonical form while typing or scanning: uppercase, without the spaces
 * and dashes a person may add to read it aloud (the server normalizes the
 * same way). Other characters are kept so a mistyped `0`/`1` is visible and
 * flagged instead of silently dropped.
 */
export function normalizePickupCodeInput(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase().slice(0, 16);
}

export function isPickupCodeShape(code: string): boolean {
  return PICKUP_CODE_PATTERN.test(code);
}
