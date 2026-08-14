import "server-only";

import { Prisma } from "../../../../generated/prisma";

/** Mean Earth radius used by the Haversine formula. */
export const EARTH_RADIUS_KM = 6371;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometers between two points (Haversine).
 * Shared by the request→business notification (M2-W3), the customer quote
 * comparator (M3-W1) and the business radar (M5-W1).
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);

  const halfChord =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(halfChord));
}

/**
 * Same Haversine as `haversineKm` but as a parameterized SQL expression, so
 * radius filters run inside Postgres instead of loading every row. `origin`
 * values are bound as parameters; the column fragments must be trusted
 * identifiers built with `Prisma.raw` (never user input), e.g.
 * `Prisma.raw('b."latitude"')`.
 */
export function haversineKmSql(
  origin: GeoPoint,
  latitudeColumn: Prisma.Sql,
  longitudeColumn: Prisma.Sql,
): Prisma.Sql {
  return Prisma.sql`(
    2 * ${EARTH_RADIUS_KM} * asin(
      sqrt(
        power(sin(radians(${latitudeColumn} - ${origin.latitude}) / 2), 2)
        + cos(radians(${origin.latitude}))
          * cos(radians(${latitudeColumn}))
          * power(sin(radians(${longitudeColumn} - ${origin.longitude}) / 2), 2)
      )
    )
  )`;
}
