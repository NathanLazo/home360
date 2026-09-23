/**
 * Marketplace categories a service request may resolve to. They match the
 * design's C1 category chips and the seeded service catalog (`category` is a
 * free string column, so this list is the single source of truth for
 * requests). Shared by the AI diagnosis, the manual fallback and the corporate
 * request form. Values are data keys; the UI translates them.
 */
export const REQUEST_CATEGORIES = [
  "Plomería",
  "Eléctrico",
  "Pintura",
  "Carpintería",
  "Limpieza",
  "Jardinería",
  "Clima",
  "Otro",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
