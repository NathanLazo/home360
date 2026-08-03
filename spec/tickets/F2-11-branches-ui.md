# [F2-11] W8 — UI de sucursales `/dashboard/branches` (cards en grid)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §4; `spec/00-foundations.md` §7
- **Depende de**: F2-01, F2-09 (serializa los mensajes compartidos), F2-10, F2-14
  (routers registrados)
- **Tamaño estimado**: M

## Contexto

Vista W8: **cards en grid** (no tabla), header con uso del plan ("3 de 5 disponibles en
tu plan"; `max: null` → "ilimitadas"), Sheet de alta/edición y placeholder estático del
mapa de cobertura (mapa real fuera de alcance por spec).

Nota de resolución (F2-10 #4): tras eliminar la sucursal seleccionada en `?branch=`, el
hook de mutations debe limpiar el parámetro de la URL.

## Alcance

Crear bajo `src/app/[locale]/dashboard/branches/`:

- `page.tsx` · `loading.tsx` · `error.tsx`
- `_components/branches-view.tsx`
- `_components/branch-card.tsx`
- `_components/branch-card-actions.tsx`
- `_components/branch-form-sheet.tsx`
- `_components/branch-form-fields.tsx`
- `_components/branch-coverage-map.tsx`
- `_components/branch.types.ts`
- `_components/use-branch-mutations.ts`
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (`dashboard.branches.*`)

Modificar:

- `_components/branch.schema.ts` solo para validación presentacional adicional; el
  contrato Zod base ya lo crea F2-10 y no se duplica.

Fuera de alcance: procedures (F2-10), mapa interactivo real.
No modificar claves ajenas a `dashboard.branches.*`; F2-09 precede este ticket para que
el JSON compartido no tenga dos escritores simultáneos.

## Detalle técnico

- **`page.tsx`**: prefetch `branch.list` + `HydrateClient` → `<BranchesView />`. Ignora
  `?branch` como filtro (la vista siempre muestra todas), pero no lo borra de la URL.
- **`branches-view.tsx`**: `PageHeader` con subtítulo de uso del plan
  (`dashboard.branches.usage` con ICU: `"{used} de {max} disponibles en tu plan"`;
  variante `usageUnlimited` cuando `max === null`) + botón "Nueva sucursal"; grid
  responsive de `branch-card.tsx` (1/2/3 columnas).
  Desempaqueta `TrpcResponse`: usa `response.result` cuando existe, traduce
  `response.error` con `errors.<code>` y reserva `query.error` para transporte.
- **`branch-card.tsx`**: nombre, dirección, encargado (`managerName ?? "—"`),
  órdenes/mes (`monthlyOrders`), radio de cobertura, `StatusBadge` Activa (verde) /
  Pausada (ámbar), `branch-coverage-map.tsx` como visual superior y
  `branch-card-actions.tsx` (⋯).
- **`branch-coverage-map.tsx`**: placeholder estático (SVG/div decorativo con círculo de
  radio y `coverageRadiusKm` como etiqueta); sin dependencias nuevas; `aria-hidden`.
- **`branch-card-actions.tsx`**: editar / pausar-activar / eliminar (ConfirmDialog).
  `CONFLICT` al eliminar → toast explicando que hay órdenes activas
  (`dashboard.branches.deleteConflict`). `PLAN_LIMIT_REACHED` al crear → toast + el botón
  "Nueva sucursal" se deshabilita cuando `used >= max` (con tooltip que invita a mejorar
  el plan — sin link a W7 hasta F4, solo texto).
- **`branch-form-sheet.tsx` / `branch-form-fields.tsx`**: name, address, managerName
  (opcional), coverageRadiusKm (input numérico o slider 1–100). Validación `safeParse`
  con `branchCreateSchema`/`branchUpdateSchema`.
- **`use-branch-mutations.ts`**: create/update/setStatus/delete + toast + invalidate de
  `branch.list`; tras delete exitoso, si `searchParams.branch === deletedId` →
  `router.replace` sin el param. Invalidar también las queries de `dashboard.*` (los
  buckets por sucursal cambian).
- **Estados**: skeleton de grid de cards; `EmptyState` con CTA; `error.tsx`.
- **i18n**: `dashboard.branches.*` completo es/en (incluye plurales/ICU del uso del plan).

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

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Con seed: 3 cards con datos reales y header "3 de 5 disponibles en tu plan".
- [ ] CRUD completo con toasts; eliminar con órdenes activas comunica el conflicto.
- [ ] `max` ilimitado muestra el copy "ilimitadas" y nunca deshabilita el alta.
- [ ] Eliminar la sucursal seleccionada en el selector limpia `?branch` y la UI cae a "Todas".
- [ ] Cards y Sheet operables con teclado; focus visible.
- [ ] Error de contrato y error de transporte tienen estados separados y localizados.

## Comandos para Roger (si aplica)

—
