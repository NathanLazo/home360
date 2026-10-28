import "server-only";

import type { z } from "zod";

import { env } from "~/env";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { CHIHUAHUA_CITY_CENTER } from "./coverage";
import {
  autocompleteResponseSchema,
  pickNeighborhood,
  placeDetailsResponseSchema,
  reverseGeocodeResponseSchema,
} from "./google-maps.schemas";
import type { GeoPoint } from "./haversine";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const REQUEST_TIMEOUT_MS = 5_000;
/** Places (New) caps the bias circle at 50 km. */
const BIAS_RADIUS_METERS = 30_000;
const MAX_SUGGESTIONS = 5;

export type GeoLocale = "es" | "en";

export type GeoError = "GEO_UNAVAILABLE";

export type GeoSuggestion = {
  placeId: string;
  primary: string;
  secondary: string | null;
};

export type ResolvedPlace = {
  addressLine: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  placeId: string | null;
};

export function isGeoConfigured(): boolean {
  return env.GOOGLE_MAPS_API_KEY !== undefined;
}

type FetchOutcome<T> =
  { kind: "ok"; data: T } | { kind: "not_found" } | { kind: "unavailable" };

/**
 * One upstream call: timeout, non-2xx and malformed bodies all collapse to
 * `unavailable` (logged, never exposed); a 404 is a distinct `not_found`.
 */
async function fetchJson<TData>(
  url: string,
  init: RequestInit,
  schema: z.ZodType<TData, z.ZodTypeDef, unknown>,
): Promise<FetchOutcome<TData>> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (!response.ok) {
      console.error(
        `[geo] upstream ${response.status} for ${new URL(url).pathname}`,
      );
      return { kind: "unavailable" };
    }

    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      console.error("[geo] unexpected upstream response shape");
      return { kind: "unavailable" };
    }

    return { kind: "ok", data: parsed.data };
  } catch (error) {
    console.error("[geo] upstream request failed", error);
    return { kind: "unavailable" };
  }
}

/** Address autocomplete biased to Mexico and to `near` (or Chihuahua city). */
export async function suggestPlaces(input: {
  query: string;
  locale: GeoLocale;
  near?: GeoPoint;
  sessionToken?: string;
}): Promise<ServiceResult<{ items: GeoSuggestion[] }, GeoError>> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return svcFail("GEO_UNAVAILABLE", "Geo provider not configured");
  }

  const center = input.near ?? CHIHUAHUA_CITY_CENTER;
  const outcome = await fetchJson(
    `${PLACES_BASE_URL}/places:autocomplete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: input.query,
        regionCodes: ["mx"],
        languageCode: input.locale,
        locationBias: {
          circle: {
            center: { latitude: center.latitude, longitude: center.longitude },
            radius: BIAS_RADIUS_METERS,
          },
        },
        ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      }),
    },
    autocompleteResponseSchema,
  );

  if (outcome.kind === "unavailable") {
    return svcFail("GEO_UNAVAILABLE", "Autocomplete unavailable");
  }

  if (outcome.kind === "not_found") {
    return svcOk({ items: [] });
  }

  const items: GeoSuggestion[] = [];

  for (const suggestion of outcome.data.suggestions) {
    const prediction = suggestion.placePrediction;

    if (!prediction) continue;

    const primary =
      prediction.structuredFormat?.mainText.text ?? prediction.text?.text;

    if (!primary) continue;

    items.push({
      placeId: prediction.placeId,
      primary,
      secondary: prediction.structuredFormat?.secondaryText?.text ?? null,
    });

    if (items.length >= MAX_SUGGESTIONS) break;
  }

  return svcOk({ items });
}

/** Place details for an autocomplete pick (closes the billing session). */
export async function resolvePlace(input: {
  placeId: string;
  locale: GeoLocale;
  sessionToken?: string;
}): Promise<ServiceResult<ResolvedPlace, GeoError>> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return svcFail("GEO_UNAVAILABLE", "Geo provider not configured");
  }

  const params = new URLSearchParams({
    languageCode: input.locale,
    regionCode: "mx",
  });

  if (input.sessionToken) {
    params.set("sessionToken", input.sessionToken);
  }

  const outcome = await fetchJson(
    `${PLACES_BASE_URL}/places/${encodeURIComponent(input.placeId)}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
      },
    },
    placeDetailsResponseSchema,
  );

  if (outcome.kind === "unavailable") {
    return svcFail("GEO_UNAVAILABLE", "Place details unavailable");
  }

  if (outcome.kind === "not_found") {
    return svcFail("NOT_FOUND", "Place not found");
  }

  const place = outcome.data;

  return svcOk({
    addressLine: place.formattedAddress,
    neighborhood: pickNeighborhood(
      place.addressComponents.map((component) => ({
        name: component.longText,
        types: component.types,
      })),
    ),
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    placeId: place.id,
  });
}

/** Reverse geocoding (Geocoding API): coordinates → address + colonia. */
export async function reverseGeocode(input: {
  latitude: number;
  longitude: number;
  locale: GeoLocale;
}): Promise<ServiceResult<ResolvedPlace, GeoError>> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return svcFail("GEO_UNAVAILABLE", "Geo provider not configured");
  }

  const params = new URLSearchParams({
    latlng: `${input.latitude},${input.longitude}`,
    language: input.locale,
    region: "mx",
    key: apiKey,
  });
  const outcome = await fetchJson(
    `${GEOCODE_URL}?${params.toString()}`,
    { method: "GET" },
    reverseGeocodeResponseSchema,
  );

  if (outcome.kind === "unavailable") {
    return svcFail("GEO_UNAVAILABLE", "Reverse geocoding unavailable");
  }

  if (outcome.kind === "not_found") {
    return svcFail("NOT_FOUND", "No address at these coordinates");
  }

  const { status, results } = outcome.data;

  if (status === "ZERO_RESULTS" || (status === "OK" && results.length === 0)) {
    return svcFail("NOT_FOUND", "No address at these coordinates");
  }

  const best = results[0];

  if (status !== "OK" || !best) {
    console.error(`[geo] reverse geocoding status ${status}`);
    return svcFail("GEO_UNAVAILABLE", "Reverse geocoding unavailable");
  }

  // The colonia may live on a broader result than the street-level one.
  const neighborhood =
    results
      .map((result) =>
        pickNeighborhood(
          result.address_components.map((component) => ({
            name: component.long_name,
            types: component.types,
          })),
        ),
      )
      .find((name) => name !== null) ?? null;

  return svcOk({
    addressLine: best.formatted_address,
    neighborhood,
    latitude: input.latitude,
    longitude: input.longitude,
    placeId: best.place_id ?? null,
  });
}
