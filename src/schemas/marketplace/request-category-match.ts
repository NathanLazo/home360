import {
  REQUEST_CATEGORIES,
  type RequestCategory,
} from "./request-categories";

/**
 * Service categories are free text typed by each business ("plomeria",
 * "Electricidad", "Aire acondicionado"), while requests always carry a
 * canonical `RequestCategory`. Exact string equality made most catalogs
 * invisible to the radar, so matching goes through this canonical mapping:
 * case/diacritic-insensitive equality plus common trade synonyms.
 */
function normalizeCategory(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CATEGORY_ALIASES: Record<RequestCategory, readonly string[]> = {
  Plomería: ["plomeria", "plomero", "plomeros", "fontaneria", "plumbing"],
  Eléctrico: [
    "electrico",
    "electrica",
    "electricidad",
    "electricista",
    "instalaciones electricas",
    "electrical",
  ],
  Pintura: ["pintura", "pintor", "pintores", "painting"],
  Carpintería: ["carpinteria", "carpintero", "carpinteros", "carpentry"],
  Limpieza: ["limpieza", "aseo", "cleaning"],
  Jardinería: ["jardineria", "jardinero", "jardin", "gardening"],
  Clima: [
    "clima",
    "climas",
    "climatizacion",
    "aire acondicionado",
    "minisplit",
    "refrigeracion",
    "hvac",
  ],
  Otro: ["otro", "otros", "other"],
};

const CANONICAL_BY_ALIAS = new Map<string, RequestCategory>(
  REQUEST_CATEGORIES.flatMap((category) =>
    [category, ...CATEGORY_ALIASES[category]].map(
      (alias) => [normalizeCategory(alias), category] as const,
    ),
  ),
);

/** Canonical request category for a free-text service category, if any. */
export function toRequestCategory(value: string): RequestCategory | null {
  return CANONICAL_BY_ALIAS.get(normalizeCategory(value)) ?? null;
}
