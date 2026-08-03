# [F6-18] Ejecutar el recorrido manual final de la app y la revisión contra el diseño

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §4.2 y §4.3 (verificación manual y revisión
  lado a lado contra `HOME360 Web.dc.html`); §Criterios de aceptación
- **Depende de**: `F6-17` (build verde); F2–F5 implementadas
- **Tamaño estimado**: M

## Contexto

**Hueco de cobertura detectado**: `F6-12`…`F6-16` cubren cada dimensión de calidad por
separado y `F6-17` la build, pero nadie ejecuta la verificación de §4.2 (landing en es/en,
móvil y desktop, `prefers-reduced-motion` activo, navegación por anclas, CTAs → `/register`)
ni el §4.3 (recorrido de todas las pantallas contra el diseño). Este ticket cierra la fase.

El diseño de referencia está versionado en `design/HOME360-Web.dc.html`; se usa para
W1–W13. Las rutas añadidas fuera de ese artefacto (`/register`, recuperación de contraseña,
orders, team y settings) se comparan con el patrón del módulo hermano indicado en su ticket,
sin inventar una pantalla de diseño.

## Alcance

- **No se crean features**. Solo fixes puntuales que el recorrido detecte, en los
  `_components/` del módulo afectado o en componentes compartidos de `src/components/`.
- Entregable: reporte de verificación en la descripción del PR (matriz ruta × check), sin
  archivo nuevo en el repo — misma convención que `F6-12`.
- Todo hallazgo que exceda un fix puntual (rediseño, cambio de contrato, decisión de
  producto) se anota en el reporte y **no** se implementa aquí.

Fuera de alcance: build y contrato (`F6-17`); nuevas dimensiones de calidad.

## Detalle técnico

### 1. Landing (§4.2)

Después de `pnpm build`, levantar la build existente con `pnpm start` (no `pnpm preview`,
que volvería a construir):

1. `/` (es) y `/en`: copy completo, cero claves crudas (`landing.hero.title` en pantalla =
   bug), tipografía y jerarquía `h1 → h2 → h3` correctas.
2. Anchos 375 / 768 / 1024 / 1440 px: hero apilado, bento 3→1, pricing 3→1, sin scroll
   horizontal del body.
3. **`prefers-reduced-motion: reduce`** (DevTools → Rendering → *Emulate CSS media feature
   prefers-reduced-motion*): la landing queda **100 % estática** — BlurFade, TextAnimate
   y NumberTicker muestran su estado final; sin AnimatedBeam, sin BorderBeam animado, sin
   shimmer en el CTA, sin `scroll-behavior: smooth`. El contenido visible debe ser
   idéntico al de la versión animada (mismo árbol de copy y mismas cifras finales).
4. Sin reduced motion: cada animación corre **una sola vez** al entrar en viewport
   (recargar y volver a hacer scroll para confirmar que no se repite en loop); el único
   loop permitido es `AnimatedBeam`.
5. Anclas del header: "Cómo funciona" → `#how-it-works`, "Para negocios" → `#for-business`,
   "Garantías" → `#guarantees`, "Precios" → `#pricing`; ninguna sección queda tapada por el
   header sticky (verificar `scroll-margin-top`) y todas son alcanzables con teclado.
6. CTAs accionables de registro: hero, header, los 3 de pricing y cierre → `/register`
   (y `/en/register` desde inglés); "Iniciar sesión" → `/login`; "Descargar la app"
   permanece deshabilitado con explicación, no cuenta como enlace roto.
7. Con JavaScript deshabilitado la landing sigue siendo legible y navegable por anclas.
8. `LocaleSwitcher` del footer conserva la ruta al alternar es/en.

### 2. Recorrido de pantallas (§4.3)

Recorrer **todas** las rutas de la app, no solo las 13 numeradas del README: W1–W13 más
`/register`, `/forgot-password`, `/reset-password`, `/dashboard/orders`,
`/dashboard/team` y `/dashboard/settings`. Por ruta, en es y en:

| Check | Criterio |
|-------|----------|
| Diseño | Coincide con `design/HOME360-Web.dc.html` en secciones, columnas, orden y jerarquía (o, si no hay diseño para la ruta, replica el patrón de su módulo hermano) |
| Estados | `loading` (throttling *Slow 3G*), `error` (offline / forzar fallo), `empty` (usuario/negocio sin datos) |
| Teclado | Tab completo, focus visible, Escape cierra sheets/dialogs, foco vuelve al trigger |
| Formatos | Montos MXN desde centavos, fechas y números por locale, folios/SKU en mono |
| Consistencia | Verbos de acción, orden de botones y `StatusBadge` según `F6-16` |
| Identidad | W1 usa navy/gold/cream/gray; dashboard/admin permanecen zinc y no consumen `--brand-*` |

Datos: sesión de negocio ("Plomería García"), sesión admin (`admin@home360.mx`) y, si
existe tras `XC-10`, el negocio en plan `basic` para los límites de plan.

### 3. Reporte

Matriz ruta × check con estado (OK / corregido / abierto) y, para cada "abierto", una
línea con severidad y propuesta. Incluir capturas de las diferencias contra el diseño.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Los fixes de este pase son puntuales y visuales/a11y; ninguna corrección puede tocar
  routers, servicios ni schema (si el recorrido revela un bug de lógica, se reporta).

## Criterios de aceptación

- [ ] Landing verificada en es/en, 4 anchos, con y sin `prefers-reduced-motion`; con
      reduced motion la landing es 100 % estática y no pierde contenido.
- [ ] Las 4 anclas navegan sin quedar tapadas; todos los CTAs accionables de registro
      llevan a `/register` en ambos locales y el CTA de app no es un enlace roto.
- [ ] Todas las rutas recorridas con los 6 checks de la tabla; matriz incluida en el PR.
- [ ] W1–W13 comparadas con `design/HOME360-Web.dc.html`; rutas sin diseño comparadas con
      su módulo hermano y marcadas como tales.
- [ ] Frontera D7 observable: marca solo en landing, zinc en dashboard/admin.
- [ ] Cero claves i18n crudas y cero scroll horizontal del body en 375 px.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde tras los fixes.

## Comandos para Roger (si aplica)

Antes del recorrido, Roger confirma que ya existen migraciones y datos demo utilizables.
Este ticket no prescribe ni ejecuta comandos de BD. Para servir la build ya generada:

```bash
pnpm start
```
