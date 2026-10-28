import { z } from "zod";

/**
 * Minimal Zod views of the Google Places API (New) and Geocoding responses
 * (§3). Only the fields we read are declared; unknown keys are ignored.
 */

const textSchema = z.object({ text: z.string() });

export const autocompleteResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().min(1),
            text: textSchema.optional(),
            structuredFormat: z
              .object({
                mainText: textSchema,
                secondaryText: textSchema.optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

export const placeDetailsResponseSchema = z.object({
  id: z.string().min(1),
  formattedAddress: z.string().min(1),
  addressComponents: z
    .array(
      z.object({
        longText: z.string(),
        types: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

export const reverseGeocodeResponseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z.object({
        place_id: z.string().optional(),
        formatted_address: z.string(),
        address_components: z
          .array(
            z.object({
              long_name: z.string(),
              types: z.array(z.string()).default([]),
            }),
          )
          .default([]),
        geometry: z.object({
          location: z.object({ lat: z.number(), lng: z.number() }),
        }),
      }),
    )
    .default([]),
});

/** Colonia lookup order: Google tags Mexican colonias as sublocality_level_1. */
const NEIGHBORHOOD_TYPES = [
  "sublocality_level_1",
  "sublocality",
  "neighborhood",
] as const;

/** Picks the colonia from normalized address components (null when absent). */
export function pickNeighborhood(
  components: ReadonlyArray<{ name: string; types: readonly string[] }>,
): string | null {
  for (const type of NEIGHBORHOOD_TYPES) {
    const match = components.find((component) =>
      component.types.includes(type),
    );
    const name = match?.name.trim();

    if (name) {
      return name;
    }
  }

  return null;
}
