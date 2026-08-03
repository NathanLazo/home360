# [F6-02] Crear el copy es/en de la landing y sus datos estáticos

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1; `spec/00-foundations.md` §6 (i18n),
  §9 (planes del seed); `spec/04-subscriptions.md` §1 (modelo comercial);
  `spec/08-business-model-alignment.md` D1, D7 y D8
- **Depende de**: `F0-07` (next-intl y mensajes es/en)
- **Tamaño estimado**: M

## Contexto

Todo el copy visible de W1 vive en `landing.json` (es/en). Los valores no traducibles
(precios en centavos, ids de ancla, nombres de icono lucide) viven en un archivo de datos
del módulo.

Problemas detectados y resueltos aquí:

1. **Anclas del header sin sección destino**: la nav ofrece "Cómo funciona / Para
   negocios / Garantías / Precios", pero la estructura solo define anclas explícitas para
   "Cómo funciona" y (implícitamente) precios. Resolución: mapa fijo de anclas —
   `#how-it-works` → `how-it-works-section`, `#for-business` → `features-section` (raíz),
   `#guarantees` → wrapper de la tarjeta "Garantías reales" dentro del BentoGrid (con
   `scroll-margin-top` por el header sticky), `#pricing` → `pricing-section`.
2. **Riesgo de deriva de precios**: la pricing section no lee BD; los precios se duplican
   como constantes. Resolución: constantes espejo del seed F0 (`basic` 49900 ¢/**10 %**,
   `standard` 99900 ¢/8 %, `enterprise` 199900 ¢/5 % — escalera de D1) con comentario que
   apunta a `prisma/seed.ts` como fuente de verdad.
3. **Cifras de métricas inventadas**: la spec pedía NumberTicker con cifras de marketing sin
   dar ninguna, y `F6-findings` M6 objetaba inventarlas en una plataforma pre-lanzamiento.
   Resolución (D8): se usan las **cifras reales y citables del deck**, que hablan del mercado
   y no de tracción propia:
   - `35,000,000` hogares en México que necesitan mantenimiento cada año
   - `~$350,000M` MXN de mercado anual
   - `95 %` del mercado opera en la informalidad
   - `500+` proveedores listos para el arranque

   La sección lleva pie de fuente visible ("Deck de socios 2025 · CONAPO 2025") y **no**
   presume usuarios, órdenes ni GMV propios. El copy diferencia con claridad cifras de
   mercado de proveedores preparados para el lanzamiento.

## Alcance

Crear/modificar:

- `src/messages/es/landing.json` y `src/messages/en/landing.json` (reemplazan el
  placeholder de F0 si existe).
- `src/app/[locale]/(public)/_components/landing-data.ts` (nuevo).

Fuera de alcance: componentes de la landing (F6-03…F6-06); `errors.json`; copy de
dashboard/admin.

## Detalle técnico

### `landing.json` — namespaces

```jsonc
{
  "metadata": { "title", "description" },
  "header": { "nav": { "howItWorks", "forBusiness", "guarantees", "pricing" }, "login", "cta" },
  "hero": { "badge", "title", "subtitle", "ctaPrimary", "ctaSecondary" },
  "heroVisual": { "photoLabel", "diagnosisLabel", "escrowLabel", "alt" },
  "features": { "title", "subtitle",
    "aiDiagnosis": { "title", "description" },
    "protectedPayments": { "title", "description" },
    "realGuarantees": { "title", "description" } },
  "howItWorks": { "title", "steps": { "1": { "title", "description" }, "2": …, "3": … } },
  "metrics": { "title", "households", "marketSize", "informality", "providers", "source" },
  "guaranteeTypes": { "title", "subtitle", "recording": { "title", "description" },
    "types": { "deposit", "insurance", "combined", "verification", "asset" } },
  "pricing": { "title", "subtitle", "perMonth", "commission", "unlimited", "cta",
    "plans": { "basic": { "name", "features": [...] }, "standard": …, "enterprise": … } },
  "cta": { "title", "subtitle", "register", "downloadApp", "downloadAppSoon" },
  "footer": { "tagline", "rights", "links": { … } }
}
```

Copy es (default) fiel al diseño: badge "Diagnóstico con IA + pagos protegidos", CTA
"Registra tu negocio", nav "Cómo funciona / Para negocios / Garantías / Precios". EN es
traducción completa (sin claves faltantes). Tipografía correcta: comillas y guiones
tipográficos, sin comillas rectas en copy.

**Taglines oficiales del brandbook** (D7) — se usan literales, no se reescriben:

- Principal (hero o cierre): "El único lugar donde puedes dejar la llave de tu casa con
  total tranquilidad."
- Secundario (footer): "Tu hogar, en buenas manos."
- Descriptivo (`<title>` y meta description, no visible en la página): "Servicios para el
  hogar. Con garantía real."

**Sección de garantías** (nueva, `guaranteeTypes`): el deck la trata como *el* diferenciador
("5 modalidades de garantía. Ningún competidor tiene una."), así que la landing la comunica
explícitamente: depósito en efectivo ($3,000–$10,000 en fideicomiso), seguro por servicio,
combinada A+B (recomendada), solo verificación (INE, biometría, antecedentes) y bien
inmueble o mueble registrado. Junto a ellas, la grabación obligatoria del servicio, cuya
ausencia resuelve a favor del cliente.

### `landing-data.ts`

Constantes tipadas (sin `any`; `as const` estrecho sí se permite para mapas y tuplas):

```ts
export const LANDING_ANCHORS = {
  howItWorks: "how-it-works",
  forBusiness: "for-business",
  guarantees: "guarantees",
  pricing: "pricing",
} as const;

export type LandingPlan = {
  code: "basic" | "standard" | "enterprise";
  priceCents: number;        // 49900 | 99900 | 199900 — espejo de prisma/seed.ts
  commissionPct: number;     // 10 | 8 | 5 — escalera D1
  maxBranches: number | null;
  maxWorkers: number | null;
  maxProducts: number | null;
  highlighted: boolean;      // standard = true
};
export const LANDING_PLANS: readonly LandingPlan[];

// D8 — cifras de mercado, no de tracción propia. Fuente: deck de socios / CONAPO 2025.
export const LANDING_METRICS = {
  households: 35_000_000,
  marketSizeCents: 35_000_000_000_000, // ~$350,000M MXN
  informalityPct: 95,
  readyProviders: 500,
} as const;

export type LandingFeatureKey = "aiDiagnosis" | "protectedPayments" | "realGuarantees";
export const LANDING_FEATURES: readonly {
  key: LandingFeatureKey;
  icon: LucideIcon;
}[]; // ScanSearch, ShieldCheck, BadgeCheck

// D7 — las 5 modalidades de garantía, el diferenciador del deck
export const LANDING_GUARANTEES: readonly {
  key: "deposit" | "insurance" | "combined" | "verification" | "asset";
  recommended: boolean;   // combined = true
  icon: LucideIcon;
}[];
```

Los montos se formatean en UI con el formatter next-intl (MXN, desde centavos).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `landing.json` es y en con conjuntos de claves idénticos, comprobados por revisión
      de los JSON (sin crear tests).
- [ ] Precios/comisiones idénticos a los del seed F0 y `spec/04-subscriptions.md` §1.
- [ ] Métricas comunican mercado, no tracción propia, y muestran la fuente visible del
      deck/CONAPO; tagline y paleta textual siguen D7.
- [ ] Ningún string visible fuera de `landing.json`; `landing-data.ts` solo contiene
      valores no traducibles.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
