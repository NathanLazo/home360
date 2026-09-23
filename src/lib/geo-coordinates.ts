/**
 * Parses a coordinate typed in a form field. Empty means "no coordinate"
 * (`null`); a decimal comma is accepted. Range validation stays in Zod, so an
 * unparseable value comes back as `NaN` and fails the schema.
 */
export function parseCoordinate(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  return trimmed.length === 0 ? null : Number(trimmed);
}

/** Form value for a stored coordinate (`null` → empty field). */
export function coordinateToField(value: number | null): string {
  return value === null ? "" : String(value);
}
