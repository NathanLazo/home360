# [F6-06] Construir metrics (NumberTicker), pricing y sección CTA final

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1 (metrics-section, pricing-section,
  cta-section); `spec/04-subscriptions.md` §1 y §5 (contenido de los planes)
- **Depende de**: `F6-01`, `F6-02`, `F6-03`, `F6-05` (serializa `landing-view.tsx`)
- **Tamaño estimado**: M

## Contexto

Cierre de W1: métricas de marketing con NumberTicker, los 3 planes estáticos (sin BD,
link a `/register`) y el CTA final.

Problema detectado y resuelto aquí: la spec pide en cta-section un botón "Descargar la
app", pero no existe app publicada ni URL. Un `<a href="#">` sería un enlace roto
(a11y). Resolución: renderizarlo como botón secundario deshabilitado con texto auxiliar
"Disponible próximamente" (`landing.cta.downloadAppSoon`), sin `href` (queda abierto en
`F6-findings.md` por si Roger prefiere ocultarlo o enlazar a stores).

## Alcance

Crear/modificar:

- `src/app/[locale]/(public)/_components/metrics-section.tsx`
- `src/app/[locale]/(public)/_components/pricing-section.tsx`
- `src/app/[locale]/(public)/_components/pricing-card.tsx` (nuevo — la spec no lo lista,
  pero la regla de componentización exige separar la card del grid)
- `src/app/[locale]/(public)/_components/cta-section.tsx`
- `src/app/[locale]/(public)/_components/landing-view.tsx` (sustituir stubs)

Fuera de alcance: hero/features/how-it-works; cualquier query tRPC (la landing no toca BD).

## Detalle técnico

### `metrics-section.tsx`

- Cuatro métricas desde `LANDING_METRICS` (F6-02), que son cifras **de mercado**, no de
  tracción propia (D8): 35 M de hogares, ~$350,000M MXN de mercado anual, 95 % de
  informalidad y 500+ proveedores listos.
- `NumberTicker` (`startOnView`, una vez) muestra directamente la cifra final bajo reduced
  motion por el ajuste de F6-01, sin árbol fallback duplicado. El tamaño de mercado se
  formatea en MXN compacto desde centavos con el formatter de next-intl; números en Geist
  Mono con `tabular-nums`.
- Labels desde `landing.metrics.*`, más un pie de fuente visible ("Deck de socios 2025 ·
  CONAPO 2025") en texto
  pequeño: la cifra sin fuente es una afirmación, con fuente es un dato.
- Fondo navy con números en gold (D7): es la sección de mayor peso visual de la landing.

### `pricing-section.tsx` + `pricing-card.tsx` (Server Components)

- `<section id="pricing">` (destino de la ancla "Precios") con `h2` + subtítulo.
- Grid de 3 `PricingCard` desde `LANDING_PLANS`: nombre (`landing.pricing.plans.<code>.name`),
  precio `priceCents/100` formateado MXN + "/mes", comisión, lista de features con límites
  (`null` → `landing.pricing.unlimited`), `standard` resaltada (borde `#09090b` + badge).
- CTA de cada card → `Link` a `/register` (botón primario en la resaltada, outline en el
  resto). Sin BD y sin `changePlan`: los planes reales se gestionan en W7 (F4).
- Entrada con `BlurFade` escalonado; F6-01 entrega estado final estático bajo reduced motion.

### `cta-section.tsx` (Server Component)

- Banda de cierre navy (`var(--brand-navy)`) con acento gold, sin gradientes: `h2`,
  subtítulo, CTA primario "Registra tu negocio" → `/register` y botón
  "Descargar la app" deshabilitado + nota "Disponible próximamente".

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Animaciones una vez y estáticas bajo reduced motion; ShimmerButton **no** se usa aquí
  (solo hero). D7: marca en landing; no modificar zinc de dashboard/admin.

## Criterios de aceptación

- [ ] NumberTicker anima una vez al entrar en viewport; con reduced motion muestra la
      cifra final sin animación.
- [ ] Los 3 planes replican precios/comisiones/límites del seed; CTAs → `/register`.
- [ ] Ancla `#pricing` funciona; montos siempre vía formatter MXN desde centavos.
- [ ] Métricas muestran fuente visible y nunca se presentan como usuarios, órdenes o GMV.
- [ ] Cero strings hardcodeados; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
