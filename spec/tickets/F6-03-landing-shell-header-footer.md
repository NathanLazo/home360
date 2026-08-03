# [F6-03] Montar el shell de la landing: page, view, header sticky y footer

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1 (Estructura, Reglas de motion);
  `spec/00-foundations.md` §1 (placeholder de landing), §6 (rutas `[locale]`)
- **Depende de**: `F6-01`, `F6-02`
- **Tamaño estimado**: M

## Contexto

W1 vive en `[locale]/(public)/page.tsx` como Server Component estático, sin datos de BD.
El único código cliente permitido en el shell es el header sticky y su navegación móvil.
Este ticket monta una página válida con header, `<main>` y footer; F6-04…F6-06 agregan las
secciones en orden. No crea stubs ni componentes temporales.

Aclaración de spec resuelta aquí: "header sticky" se implementa con CSS `sticky` +
un mínimo estado cliente solo para la sombra/fondo al hacer scroll; la navegación por
anclas usa `<a href="#…">` nativos (sin JS), compatibles con `localePrefix: "as-needed"`.

## Alcance

Crear/modificar:

- `src/app/[locale]/(public)/page.tsx` (composición delgada + metadata).
- `src/app/[locale]/(public)/_components/landing-view.tsx`
- `src/app/[locale]/(public)/_components/landing-header.tsx`
- `src/app/[locale]/(public)/_components/landing-footer.tsx`

Fuera de alcance: hero, features, how-it-works, metrics, pricing, cta (tickets F6-04 a
F6-06); login/register.

## Detalle técnico

- `page.tsx` (Server Component): `setRequestLocale`, `generateMetadata` con título y
  descripción desde `landing.json` (namespace `metadata` de F6-02), renderiza
  `<LandingView />`.
- `landing-view.tsx` (Server Component): secuencia `LandingMotionProvider →
  LandingHeader → main → LandingFooter`. F6-04…F6-06 modifican únicamente este archivo
  para insertar sus secciones en el orden normativo de la spec.
- `landing-header.tsx` (`"use client"`, único cliente del shell):
  - Sticky top, fondo cream translúcido con `backdrop-blur` y borde navy/gold sutil al
    superar ~8 px de scroll (listener pasivo).
  - Logo "H" + wordmark HOME360 (Link a `/`).
  - Nav de anclas desde `LANDING_ANCHORS` (F6-02): Cómo funciona → `#how-it-works`,
    Para negocios → `#for-business`, Garantías → `#guarantees`, Precios → `#pricing`.
    `<a>` nativos; en móvil un botón con nombre accesible abre un `Sheet` con las cuatro
    anclas, login y registro. El Sheet cierra al navegar.
  - "Iniciar sesión" → `Link` de `~/i18n` a `/login` (variante ghost/outline);
    CTA "Registra tu negocio" → `/register` (botón primario gold sobre navy).
  - `<nav aria-label>` traducido; foco visible en todos los enlaces.
- `landing-footer.tsx` (Server Component): logo, tagline, columnas de enlaces (anclas +
  `/login`, `/register`), `LocaleSwitcher` (componente compartido de F0) y línea de
  derechos con año dinámico.
- **Estética: paleta de marca, no zinc** (D7 de `spec/08-business-model-alignment.md`). La
  landing es la cara pública de HOME360 y usa los tokens `--brand-*` que declara `F0-06`:
  - Fondo cream `var(--brand-cream)` en las secciones claras y navy `var(--brand-navy)` en
    las oscuras (hero y cierre), alternando como hace el deck.
  - Acentos, subrayados del wordmark y CTA primario en gold `var(--brand-gold)`; texto
    secundario en `var(--brand-gray)` sobre navy.
  - Radio 8 px y Geist se mantienen: la tipografía no cambia entre marca y app.
  - El header usa cream translúcido estable con `backdrop-blur`, legible sobre cualquier
    sección sin lógica de detección de color.
  - **Frontera**: nada de esto sale de `(public)/`. Dashboard y admin siguen 100 % zinc.
- Sin animaciones en header/footer.
- El smooth scroll scoped a la landing ya queda definido por F6-01 únicamente bajo
  `@media (prefers-reduced-motion: no-preference)`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Server Components por defecto; cliente solo el header sticky (y animaciones en F6-04+).

## Criterios de aceptación

- [ ] `/` y `/en` renderizan header, main y footer sin errores ni datos de BD.
- [ ] Header sticky con sombra al hacer scroll; navegación desktop y Sheet móvil exponen
      las cuatro anclas con foco visible.
- [ ] "Iniciar sesión" → `/login`; CTA de registro desktop/móvil → `/register`;
      `LocaleSwitcher` alterna es/en.
- [ ] Solo la landing consume tokens de marca; no se alteran estilos zinc de dashboard/admin.
- [ ] Cero strings hardcodeados; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
