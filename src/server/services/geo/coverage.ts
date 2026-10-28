import type { GeoPoint } from "./haversine";

/**
 * Service coverage (§3): a generous bounding box around Mexico. Addresses
 * outside it are rejected with LOCATION_OUT_OF_COVERAGE.
 */
export const MEXICO_BOUNDS = {
  minLatitude: 14,
  maxLatitude: 33,
  minLongitude: -119,
  maxLongitude: -86,
} as const;

/** Launch city: default autocomplete bias when the caller sends no `near`. */
export const CHIHUAHUA_CITY_CENTER: GeoPoint = {
  latitude: 28.6353,
  longitude: -106.0889,
};

export function isWithinMexico(point: GeoPoint): boolean {
  return (
    point.latitude >= MEXICO_BOUNDS.minLatitude &&
    point.latitude <= MEXICO_BOUNDS.maxLatitude &&
    point.longitude >= MEXICO_BOUNDS.minLongitude &&
    point.longitude <= MEXICO_BOUNDS.maxLongitude
  );
}
