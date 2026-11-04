/**
 * Fixed marketplace taxonomy. A service request resolves to exactly one of
 * these and a business service declares one or more (`Service.categories`),
 * so the radar and nearby-request notifications match by equality. Shared by
 * the AI diagnosis, the manual fallback, the corporate request form, the
 * service catalog and the mobile app (which mirrors this list). Values are
 * data keys; `REQUEST_CATEGORY_MESSAGE_KEYS` maps them to ASCII i18n keys.
 * Never rename or drop a value: stored rows reference it.
 */
export const REQUEST_CATEGORIES = [
  "Plomería",
  "Eléctrico",
  "Pintura",
  "Carpintería",
  "Limpieza",
  "Jardinería",
  "Clima",
  "Albañilería",
  "Herrería",
  "Cerrajería",
  "Impermeabilización",
  "Tablaroca",
  "Pisos y azulejos",
  "Vidrios y aluminio",
  "Techos",
  "Remodelación",
  "Fumigación",
  "Electrodomésticos",
  "Gas",
  "Calentadores",
  "Drenaje y desazolve",
  "Cisternas y tinacos",
  "Paneles solares",
  "Albercas",
  "Seguridad y CCTV",
  "Redes e internet",
  "Portones automáticos",
  "Persianas y cortinas",
  "Tapicería",
  "Instalación y montaje",
  "Mudanzas",
  "Mantenimiento general",
  "Otro",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const REQUEST_CATEGORY_MESSAGE_KEYS = {
  Plomería: "plumbing",
  Eléctrico: "electrical",
  Pintura: "painting",
  Carpintería: "carpentry",
  Limpieza: "cleaning",
  Jardinería: "gardening",
  Clima: "hvac",
  Albañilería: "masonry",
  Herrería: "ironwork",
  Cerrajería: "locksmith",
  Impermeabilización: "waterproofing",
  Tablaroca: "drywall",
  "Pisos y azulejos": "flooring",
  "Vidrios y aluminio": "glassAluminum",
  Techos: "roofing",
  Remodelación: "remodeling",
  Fumigación: "pestControl",
  Electrodomésticos: "appliances",
  Gas: "gas",
  Calentadores: "waterHeaters",
  "Drenaje y desazolve": "drainage",
  "Cisternas y tinacos": "waterTanks",
  "Paneles solares": "solar",
  Albercas: "pools",
  "Seguridad y CCTV": "security",
  "Redes e internet": "networking",
  "Portones automáticos": "gates",
  "Persianas y cortinas": "blinds",
  Tapicería: "upholstery",
  "Instalación y montaje": "mounting",
  Mudanzas: "moving",
  "Mantenimiento general": "handyman",
  Otro: "other",
} as const satisfies Record<RequestCategory, string>;

export type RequestCategoryMessageKey =
  (typeof REQUEST_CATEGORY_MESSAGE_KEYS)[RequestCategory];

export function isRequestCategory(value: string): value is RequestCategory {
  return (REQUEST_CATEGORIES as readonly string[]).includes(value);
}
