# [F2-06] W4 — UI de servicios `/dashboard/services` (patrón de referencia)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §2; `spec/00-foundations.md` §7
- **Depende de**: F2-01, F2-04, F2-05, F2-14 (F2-04 serializa el archivo i18n compartido)
- **Tamaño estimado**: L

## Contexto

Vista W4 completa: tabla con filtros, Sheet lateral de alta/edición con multiselect de
trabajadores, acciones por fila. Es el **patrón de referencia** que F2-08 (productos) y
F2-11 (sucursales) replican — cuidar la separación de archivos exactamente como la spec.

Notas de resolución: el multiselect de trabajadores solo mostrará los del seed hasta que
F6 entregue el CRUD de `Worker` (documentado en `F2-findings.md`); el campo categoría es
texto libre con sugerencias de `service.listCategories` (no hay catálogo fijo en schema).

## Alcance

Crear bajo `src/app/[locale]/dashboard/services/`:

- `page.tsx` · `loading.tsx` · `error.tsx`
- `_components/services-view.tsx`
- `_components/services-table.tsx`
- `_components/service-row-actions.tsx`
- `_components/service-form-sheet.tsx`
- `_components/service-form-fields.tsx`
- `_components/service-status-badge.tsx`
- `_components/service-filters.tsx`
- `_components/service.types.ts`
- `_components/use-service-mutations.ts`
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (`dashboard.services.*`)

Modificar:

- `_components/service.schema.ts` solo si hacen falta schemas exclusivamente
  presentacionales; los schemas del contrato ya los crea F2-05 y no se duplican.

Fuera de alcance: procedures (F2-05), CRUD de workers.
No modificar claves ajenas a `dashboard.services.*`; F2-04 precede este ticket para que
dos agentes no escriban en paralelo el JSON compartido.

## Detalle técnico

- **`page.tsx`**: prefetch de `service.list` (sin filtros), `service.listCategories` y
  `service.listWorkers` + `HydrateClient` → `<ServicesView />`. Ignora `?branch`
  (servicios no tienen sucursal; ver F2-01).
- **`services-view.tsx`** (`"use client"`): orquesta estado local
  `{ sheetOpen: boolean; editing: ServiceListItem | null }` y filtros
  (`search/category/status` como estado local → params de `useQuery`); `PageHeader` (F0)
  con botón "Nuevo servicio" que abre el Sheet en modo crear.
  Las queries desempaquetan `TrpcResponse`: usan `response.result` solo si no es `null` y
  convierten `response.error` en copy localizado `errors.<code>`; `query.error` queda para
  fallos de transporte.
- **`service-filters.tsx`**: `SearchFilterBar` (F0) — input búsqueda con debounce
  (~300 ms), Select categoría (opciones de `listCategories` + "Todas"), Select estado
  (Todos/Activo/Pausado).
- **`services-table.tsx`**: `DataTable` con columnas de la spec: servicio, categoría,
  precio desde (`basePriceCents` → MXN, Geist Mono), duración (`durationMinutes` y
  `–durationMaxMinutes` si existe, formateado h/min), trabajadores (nombres separados por
  coma; vacío → "Sin asignar" atenuado, clave `dashboard.services.unassigned`), estado
  (`service-status-badge.tsx`: Activo verde / Pausado ámbar sobre `StatusBadge` F0),
  columna de `service-row-actions.tsx`. Botón "Cargar más" si `nextCursor` (o
  `useInfiniteQuery` — elegir uno y aplicarlo igual en F2-08/F2-13).
- **`service-row-actions.tsx`**: `DropdownMenu` ⋯ — editar (abre Sheet), pausar/activar
  (`setStatus`), eliminar (pasa por `ConfirmDialog` F0; si el server responde `CONFLICT`,
  toast con `errors.CONFLICT` contextualizado).
- **`service-form-sheet.tsx`**: Sheet lateral crear/editar; submit valida con
  `serviceCreateSchema`/`serviceUpdateSchema` (`safeParse`) antes de mutar; multiselect de
  trabajadores con `Command` (F0) sobre `listWorkers`.
- **`service-form-fields.tsx`**: inputs presentacionales puros (reciben
  valores/errores/handlers — sin estado propio ni fetch). Precio se captura en **pesos**
  en el input y se convierte a centavos en el submit (`Math.round(value * 100)`), única
  conversión permitida en cliente.
- **`use-service-mutations.ts`**: hook con `create/update/setStatus/delete`; en éxito →
  toast (sonner) traducido + `utils.service.list.invalidate()`; en `error` del contrato →
  toast con `errors.<code>`.
- **Estados**: `loading.tsx` skeleton de tabla; lista vacía → `EmptyState` con CTA "Nuevo
  servicio"; `error.tsx` con retry.
- **i18n**: `dashboard.services.*` (título, columnas, filtros, form labels/placeholders,
  toasts, confirmación de borrado, unassigned, empty). Sin strings hardcodeados.

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
- [ ] CRUD completo con toasts; eliminar pide confirmación; `CONFLICT` se comunica claro.
- [ ] Columnas y estados replican el diseño W4 ("Sin asignar" atenuado incluido).
- [ ] Sheet/Dropdown/Dialog operables con teclado; focus visible.
- [ ] Precios `Intl` MXN; sin montos calculados en cliente (solo conversión pesos→centavos en submit).
- [ ] Copy completo es/en.
- [ ] Queries y mutations manejan por separado error de contrato y error de transporte.

## Comandos para Roger (si aplica)

—
