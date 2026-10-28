import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  resolvePlace,
  reverseGeocode,
  suggestPlaces,
  type GeoLocale,
} from "~/server/services/geo/places";

const localeSchema = z.enum(["es", "en"]);

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Places session tokens are client-generated (UUIDs); bounded, opaque.
const sessionTokenSchema = z.string().trim().min(1).max(100).optional();

const suggestSchema = z.object({
  query: z.string().trim().min(3).max(200),
  near: pointSchema.optional(),
  sessionToken: sessionTokenSchema,
  locale: localeSchema.optional(),
});

const resolveSchema = z.object({
  placeId: z.string().trim().min(1).max(300),
  sessionToken: sessionTokenSchema,
  locale: localeSchema.optional(),
});

const reverseSchema = pointSchema.extend({
  locale: localeSchema.optional(),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  GEO_UNAVAILABLE: 503,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/** Explicit input locale first, then Accept-Language, then Spanish. */
function resolveLocale(
  explicit: GeoLocale | undefined,
  headers: Headers,
): GeoLocale {
  if (explicit) return explicit;

  const accepted = headers.get("accept-language")?.trim().toLowerCase() ?? "";
  return accepted.startsWith("en") ? "en" : "es";
}

/**
 * Address autocomplete and geocoding (§3) for any signed-in role (customers,
 * businesses, workers, corporate). Google Places API (New) + Geocoding behind
 * the optional GOOGLE_MAPS_API_KEY; without it every call answers
 * GEO_UNAVAILABLE and the app falls back to its native geocoder.
 */
export const geoRouter = createTRPCRouter({
  suggest: protectedProcedure
    .input(suggestSchema)
    .query(async ({ ctx, input }) => {
      try {
        const suggestions = await suggestPlaces({
          query: input.query,
          near: input.near,
          sessionToken: input.sessionToken,
          locale: resolveLocale(input.locale, ctx.headers),
        });

        if (!suggestions.ok) {
          return serviceFailure(suggestions.code, "Address suggest failed");
        }

        return ok(suggestions.data, "Address suggestions loaded");
      } catch (error) {
        return unexpectedFailure(error, "Address suggest failed");
      }
    }),

  resolve: protectedProcedure
    .input(resolveSchema)
    .query(async ({ ctx, input }) => {
      try {
        const place = await resolvePlace({
          placeId: input.placeId,
          sessionToken: input.sessionToken,
          locale: resolveLocale(input.locale, ctx.headers),
        });

        if (!place.ok) {
          return serviceFailure(place.code, "Place resolve failed");
        }

        return ok(place.data, "Place resolved");
      } catch (error) {
        return unexpectedFailure(error, "Place resolve failed");
      }
    }),

  reverse: protectedProcedure
    .input(reverseSchema)
    .query(async ({ ctx, input }) => {
      try {
        const place = await reverseGeocode({
          latitude: input.latitude,
          longitude: input.longitude,
          locale: resolveLocale(input.locale, ctx.headers),
        });

        if (!place.ok) {
          return serviceFailure(place.code, "Reverse geocoding failed");
        }

        return ok(place.data, "Place resolved");
      } catch (error) {
        return unexpectedFailure(error, "Reverse geocoding failed");
      }
    }),
});
