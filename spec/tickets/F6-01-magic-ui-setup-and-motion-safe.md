# [F6-01] Instalar Magic UI y asegurar motion reducido sin doble render

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §1 (Setup Magic UI, Reglas de motion)
- **Depende de**: `F0-06` (shadcn/ui, Tailwind 4 y tokens de marca)
- **Tamaño estimado**: M

## Contexto

La landing W1 usa siete componentes Magic UI instalados vía registry shadcn. **Auditoría
del comando de instalación vs. la estructura de la spec**: los 7 componentes del comando
se usan todos (`blur-fade` → entradas escalonadas, `text-animate` → titular del hero,
`shimmer-button` → CTA primario, `bento-grid` → features, `number-ticker` → métricas,
`animated-beam` → hero visual, `border-beam` → hover de feature cards) y no falta ninguno.
No hay cambio que hacer en la lista; este ticket la ejecuta tal cual.

Problema detectado y resuelto aquí: los componentes de Magic UI **no garantizan** respetar
`prefers-reduced-motion` (varios animan incondicionalmente con motion/CSS keyframes).
No se usa un `MotionSafe` universal con árbol animado + fallback, porque duplicaría el
marcado RSC y provocaría un swap del LCP tras hidratar. Se adopta un patrón híbrido:
`MotionConfig reducedMotion="user"` + ajustes de salida estática en componentes basados
en `motion`, media query para keyframes CSS y fallback estructural solo para
`AnimatedBeam`.

## Alcance

Crear/modificar:

- `src/components/ui/blur-fade.tsx`, `text-animate.tsx`, `shimmer-button.tsx`,
  `bento-grid.tsx`, `number-ticker.tsx`, `animated-beam.tsx`, `border-beam.tsx`
  (generados por la CLI; ajustes mínimos de reduced motion y tokens de marca).
- `src/app/[locale]/(public)/_components/landing-motion-provider.tsx` (nuevo).
- `src/app/[locale]/(public)/_components/motion-safe.tsx` (nuevo, exclusivo para
  `AnimatedBeam`).
- `src/styles/globals.css` (solo keyframes/utilidades agregados por Magic UI y media query
  de reduced motion; no tocar tokens zinc ni la frontera D7).
- `package.json` / lockfile (dependencias que arrastre el registry, p. ej. `motion`).

Fuera de alcance: cualquier sección de la landing (F6-03…F6-06); animaciones fuera de
`(public)`.

## Detalle técnico

1. Instalar:

   ```bash
   pnpm dlx shadcn@latest add @magicui/blur-fade @magicui/text-animate @magicui/shimmer-button @magicui/bento-grid @magicui/number-ticker @magicui/animated-beam @magicui/border-beam
   ```

2. Revisar el diff del registry en `src/styles/globals.css`: conservar las keyframes de
   shimmer/border beam compatibles con Tailwind 4 CSS-first, sin `tailwind.config.*`, y
   comprobar que los tokens zinc y `--brand-*` de F0 quedan intactos.

3. `landing-motion-provider.tsx` (`"use client"`): envolver sus `children` en
   `<MotionConfig reducedMotion="user">`. Las secciones siguen siendo Server Components;
   el provider recibe el contenido ya renderizado.

4. Componentes basados en `motion`:

   - `BlurFade`, `TextAnimate` y `NumberTicker` consultan `useReducedMotion`; al reducir,
     renderizan inmediatamente el estado final, sin delay, transición ni contador.
   - `AnimatedBeam` no se monta bajo reduced motion; su alternativa son líneas SVG
     estáticas con la misma geometría.

5. `motion-safe.tsx` (`"use client"`) se reserva al único árbol realmente distinto:

   ```ts
   type MotionSafeProps = {
     children: React.ReactNode; // AnimatedBeam
     fallback: React.ReactNode; // líneas SVG estáticas
   };
   export function MotionSafe({ children, fallback }: MotionSafeProps): React.ReactNode;
   ```

   - Hook interno `usePrefersReducedMotion()` con
     `window.matchMedia("(prefers-reduced-motion: reduce)")` + listener `change`.
   - SSR/primer render: el fallback es visible y ocupa exactamente el mismo espacio; al
     habilitar motion no cambia el layout.
   - Sin dependencia de motion/framer: solo React + matchMedia.

6. En `@media (prefers-reduced-motion: reduce)`, anular las animaciones y transiciones de
   shimmer/border beam y cualquier `scroll-behavior: smooth` de la landing.

7. Ajustar colores del registry a `--brand-navy`, `--brand-gold`, `--brand-cream` y
   `--brand-gray`. D7 prohíbe usar esos tokens fuera de `(public)/`; no convertir los
   tokens shadcn del dashboard/admin.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Animaciones solo en la landing; dashboard/admin permanecen zinc y sin Magic UI.
- `MotionSafe` solo envuelve `AnimatedBeam`; queda prohibido duplicar copy o secciones
  completas como árbol animado + fallback.

## Criterios de aceptación

- [ ] Los 7 componentes existen en `src/components/ui/` y compilan (`pnpm typecheck`).
- [ ] Con reduced motion, BlurFade/TextAnimate/NumberTicker muestran su estado final,
      AnimatedBeam usa SVG estático y shimmer/border beam no animan.
- [ ] Sin reduced motion, shimmer y border beam animan en la build de producción; las
      keyframes Tailwind 4 existen y los tokens previos de `globals.css` siguen intactos.
- [ ] No hay doble árbol de contenido ni flash/salto de layout al hidratar el hero.
- [ ] La landing consume solo tokens `--brand-*`; dashboard/admin conservan zinc.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde; sin `any`.

## Comandos para Roger (si aplica)

—
