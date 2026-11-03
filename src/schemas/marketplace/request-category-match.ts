import {
  isRequestCategory,
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
  Albañilería: ["albanil", "albaniles", "obra", "construccion", "masonry"],
  Herrería: ["herrero", "soldadura", "soldador", "ironwork", "welding"],
  Cerrajería: ["cerrajero", "chapas", "cerraduras", "locksmith"],
  Impermeabilización: ["impermeabilizante", "impermeabilizar", "waterproofing"],
  Tablaroca: ["drywall", "durock", "plafones", "yeso"],
  "Pisos y azulejos": ["pisos", "azulejos", "loseta", "flooring", "tiles"],
  "Vidrios y aluminio": [
    "vidrio",
    "vidrios",
    "aluminio",
    "cancel",
    "canceles",
    "ventanas",
  ],
  Techos: ["techo", "tejado", "roofing"],
  Remodelación: ["remodelacion", "remodelaciones", "renovacion", "remodeling"],
  Fumigación: ["fumigacion", "plagas", "control de plagas", "pest control"],
  Electrodomésticos: [
    "linea blanca",
    "lavadoras",
    "refrigeradores",
    "appliances",
  ],
  Gas: ["gas lp", "gas natural", "fugas de gas", "gasero"],
  Calentadores: ["calentador", "boiler", "boilers", "water heater"],
  "Drenaje y desazolve": ["drenaje", "desazolve", "destape", "drainage"],
  "Cisternas y tinacos": [
    "cisterna",
    "cisternas",
    "tinaco",
    "tinacos",
    "bombas de agua",
  ],
  "Paneles solares": ["solar", "paneles", "energia solar", "solar panels"],
  Albercas: ["alberca", "piscina", "piscinas", "pools"],
  "Seguridad y CCTV": ["seguridad", "cctv", "camaras", "alarmas", "security"],
  "Redes e internet": ["redes", "internet", "wifi", "cableado", "networking"],
  "Portones automáticos": ["porton", "portones", "motores de porton", "gates"],
  "Persianas y cortinas": ["persianas", "cortinas", "blinds"],
  Tapicería: ["tapiceria", "tapicero", "upholstery"],
  "Instalación y montaje": [
    "instalacion",
    "montaje",
    "instalaciones",
    "mounting",
  ],
  Mudanzas: ["mudanza", "fletes", "moving"],
  "Mantenimiento general": [
    "mantenimiento",
    "handyman",
    "multiservicios",
    "reparaciones",
  ],
  Otro: ["otro", "otros", "other"],
};

/** Splits a free-text list ("Plomería, gas / Calentadores") into canonical categories. */
export function parseRequestCategories(value: string): {
  categories: RequestCategory[];
  unknown: string[];
} {
  const categories = new Set<RequestCategory>();
  const unknown: string[] = [];

  for (const part of value.split(/[,;|/\n]/u)) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    const canonical = toRequestCategory(trimmed);

    if (canonical) {
      categories.add(canonical);
    } else {
      unknown.push(trimmed);
    }
  }

  return { categories: [...categories], unknown };
}

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

/**
 * Canonical categories a service covers. Rows saved before multi-category
 * (`categories` empty, free-text `category`) fall back to the mapped legacy
 * value so old catalogs keep reaching the radar.
 */
export function serviceCategoriesOf(service: {
  category: string;
  categories: string[];
}): RequestCategory[] {
  const declared = service.categories.filter(isRequestCategory);

  if (declared.length > 0) {
    return declared;
  }

  const legacy = toRequestCategory(service.category);
  return legacy ? [legacy] : [];
}
