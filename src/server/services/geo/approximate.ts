/**
 * Coordinates rounded to 3 decimals (~110 m): enough for a zone or a
 * distance, never an exact door. Shared by the radar (customer zone) and the
 * marketplace business profile (non-pickup branches, F10 review L5).
 */
const APPROXIMATE_COORD_DECIMALS = 3;

export function approximateCoordinate(value: number): number {
  const factor = 10 ** APPROXIMATE_COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}
