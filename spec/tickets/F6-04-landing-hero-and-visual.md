# [F6-04] Construir el hero de la landing con TextAnimate, BlurFade y AnimatedBeam

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1 (hero-section, hero-visual, Reglas de motion)
- **Depende de**: `F6-01`, `F6-02`, `F6-03`
- **Tamaño estimado**: M

## Contexto

Primera sección de W1: badge, titular animado, subtítulo, dos CTAs y el visual con
mockup de la app + AnimatedBeam foto → diagnóstico → escrow.

Ambigüedad de spec resuelta aquí: la spec dice "titular con BlurFade/TextAnimate" sin
elegir. Resolución: **TextAnimate** (`by="word"`, una sola vez, `startOnView`) para el
titular; **BlurFade** escalonado (delays 80–120 ms) para badge, subtítulo y CTAs. Así el
titular no combina dos wrappers de animación.

## Alcance

Crear/modificar:

- `src/app/[locale]/(public)/_components/hero-section.tsx`
- `src/app/[locale]/(public)/_components/hero-visual.tsx`
- `src/app/[locale]/(public)/_components/landing-view.tsx` (sustituir el stub del hero)

Fuera de alcance: resto de secciones; cambios a componentes `ui/`.

## Detalle técnico

### `hero-section.tsx` (Server Component; anima vía hijos cliente de `ui/`)

- Layout dos columnas en ≥1024 px (texto izquierda, `HeroVisual` derecha); apilado en móvil.
- Orden y stagger (delays crecientes de 80–120 ms entre elementos, `inView` una vez):
  1. Badge pill (borde gold, texto `landing.hero.badge`) en `BlurFade`.
  2. Titular `h1` en `TextAnimate` (por palabra, una vez).
  3. Subtítulo `p` en `BlurFade`.
  4. Fila de CTAs en `BlurFade`: **`ShimmerButton` solo aquí** (CTA primario
     "Registra tu negocio" → `/register`, único ShimmerButton de toda la app) + botón
     secundario outline "Ver cómo funciona" → `#how-it-works`.
- `LandingMotionProvider` y los componentes ajustados en F6-01 resuelven reduced motion
  sobre el mismo árbol; no duplicar badge, titular, subtítulo ni CTAs como fallbacks.

### `hero-visual.tsx` (`"use client"` — AnimatedBeam requiere refs)

- Mockup estilizado de la app móvil: card cream con borde gold/navy, esquinas 8 px, contenido
  esquemático (sin imagen externa; si se usa `<img>`/`next/image`, `alt` desde
  `landing.heroVisual.alt`).
- Tres nodos etiquetados (foto → diagnóstico IA → pago escrow, labels de
  `landing.heroVisual.*`) conectados con dos `AnimatedBeam` (único loop permitido en la
  app). Colores del beam en escala zinc.
- Solo los beams van dentro de `MotionSafe`; `fallback` = mismos nodos unidos por líneas SVG estáticas
  (mismo layout, cero animación).
- El conjunto usa `<figure aria-label={t("heroVisual.alt")}>`; formas, iconos y líneas son
  `aria-hidden`, mientras los tres labels visibles permanecen disponibles al lector.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Animaciones una sola vez (`inView`), nada en loop salvo AnimatedBeam; `MotionSafe` solo
  para beams. D7: hero navy/cream con acentos gold; no usar zinc como identidad de W1 ni
  propagar tokens de marca al dashboard/admin.

## Criterios de aceptación

- [ ] Hero replica jerarquía del diseño W1; stagger 80–120 ms; titular anima una sola vez.
- [ ] `ShimmerButton` únicamente en el CTA primario del hero; CTA → `/register`.
- [ ] Con `prefers-reduced-motion: reduce` el hero es 100 % estático (beams incluidos).
- [ ] Hero usa la paleta de marca D7 y el visual tiene nombre accesible sin ocultar labels.
- [ ] Sin BD, sin strings hardcodeados; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
