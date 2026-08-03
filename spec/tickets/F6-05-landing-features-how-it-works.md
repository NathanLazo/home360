# [F6-05] Construir features (BentoGrid + BorderBeam) y "Cómo funciona"

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1 (features-section, feature-card,
  how-it-works-section, Reglas de motion)
- **Depende de**: `F6-01`, `F6-02`, `F6-03`, `F6-04` (serializa `landing-view.tsx`)
- **Tamaño estimado**: M

## Contexto

Secciones de valor de W1: BentoGrid con 3 tarjetas (Diagnóstico IA / Pagos protegidos /
Garantías reales) y los 3 pasos numerados.

Resolución de anclas (problema detectado en F6-02): `features-section` lleva
`id="for-business"` (destino de la ancla "Para negocios") y el wrapper de la tarjeta
"Garantías reales" lleva `id="guarantees"` (destino de "Garantías"), ambos con
`scroll-margin-top` para compensar el header sticky. `how-it-works-section` lleva
`id="how-it-works"`.

## Alcance

Crear/modificar:

- `src/app/[locale]/(public)/_components/features-section.tsx`
- `src/app/[locale]/(public)/_components/feature-card.tsx`
- `src/app/[locale]/(public)/_components/how-it-works-section.tsx`
- `src/app/[locale]/(public)/_components/landing-view.tsx` (sustituir stubs)

Fuera de alcance: metrics, pricing, cta; cambios a `ui/bento-grid.tsx`.

## Detalle técnico

### `features-section.tsx` (Server Component)

- `<section id="for-business">` con `h2` + subtítulo (`landing.features.*`).
- `BentoGrid` con las 3 `FeatureCard` desde `LANDING_FEATURES` (F6-02); entrada de cada
  card con `BlurFade` escalonado (80–120 ms, una vez). El propio componente entrega su
  estado final estático bajo reduced motion (F6-01), sin duplicar la card.
- La card de garantías va envuelta en un `div id="guarantees"` con `scroll-margin-top`.

### `feature-card.tsx`

- Icono lucide (recibido por prop, tipado `LucideIcon`), título `h3`, descripción.
- `BorderBeam` visible **solo en hover** (`opacity-0 group-hover:opacity-100`); la media
  query de F6-01 desactiva su animación bajo reduced motion y conserva un borde gold
  estático. Card cream con borde navy/gold, radio 8 px.
- Sin `onClick`: las cards no son interactivas (no simular botones).

### `how-it-works-section.tsx` (Server Component)

- `<section id="how-it-works">` con `h2` y lista **ordenada** (`ol`) de 3 pasos:
  número en círculo zinc (Geist Mono), título `h3`, descripción
  (`landing.howItWorks.steps.{1..3}`).
- Entrada con `BlurFade` escalonado; grid 3 columnas ≥1024 px, apilado
  en móvil.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Animaciones una vez (`inView`) y estáticas bajo reduced motion; jerarquía de headings
  sin saltos (h1 hero → h2 secciones → h3 cards/pasos). D7: paleta de marca solo en W1;
  dashboard/admin permanecen zinc.

## Criterios de aceptación

- [ ] BentoGrid con las 3 tarjetas y BorderBeam solo en hover.
- [ ] Anclas `#for-business`, `#guarantees` y `#how-it-works` funcionan desde el header
      sin quedar tapadas por el sticky.
- [ ] Con reduced motion: sin BlurFade ni BorderBeam, contenido íntegro.
- [ ] Cards y pasos usan tokens de marca sin introducirlos fuera de `(public)/`.
- [ ] Cero strings hardcodeados; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
