# [F6-09] Construir el módulo UI `/dashboard/team`

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §2 (`/dashboard/team`);
  `spec/02-business-dashboard.md` §2 (patrón de módulo de referencia) y §0
  (prefetch + HydrateClient)
- **Depende de**: `F6-08`, `F2-01` (layout/sidebar), `F2-10` (`branch.list`) y `F0-08`
  (`DataTable`, `ConfirmDialog`, `EmptyState`, `PageHeader`)
- **Tamaño estimado**: M

## Contexto

Módulo estándar del dashboard (mismo patrón que W4 servicios): tabla con nombre,
especialidad, invitación, servicios asignados y sucursal; Sheet de alta/edición;
ConfirmDialog al eliminar y acción de reenvío con los códigos de F6-08.

Decisión de spec resuelta aquí: la asignación worker↔servicio **no se edita** desde este
módulo (se gestiona en el form de servicios, F2 W4) — aquí los servicios asignados son
solo lectura en la tabla. Evita dos fuentes de escritura para el mismo m2m. "Sin
asignar" se muestra atenuado, igual que en W4.

## Alcance

Crear/modificar:

- `src/app/[locale]/dashboard/team/page.tsx` · `loading.tsx` · `error.tsx`
- `src/app/[locale]/dashboard/team/_components/`:
  `team-view.tsx`, `team-table.tsx`, `worker-row-actions.tsx`, `worker-form-sheet.tsx`,
  `worker-form-fields.tsx`, `team.schema.ts`, `team.types.ts`, `use-team-mutations.ts`
- Item "Equipo"/"Team" en la config del sidebar del dashboard (donde F2 declare los items
  de `AppSidebar`) — ruta `/dashboard/team`, icono lucide `Users`.
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (namespace `team`).

Fuera de alcance: router (F6-08); módulo settings (F6-10/11); edición del m2m.

## Detalle técnico

- `page.tsx`: Server Component; prefetch `api.team.list` (`~/trpc/server`) +
  `HydrateClient`; renderiza `TeamView`.
- `team-view.tsx` (`"use client"`): `api.team.list.useQuery()`; `PageHeader` con título,
  contador "X de Y trabajadores en tu plan" (`limit.used/max`; `max null` →
  `team.unlimited` solo si `canCreate`/suscripción lo permiten; sin plan muestra
  `team.noPlan`) y botón "Nuevo trabajador" que abre el Sheet. Estado local
  `{ open, editingWorker }`.
- `team-table.tsx`: `DataTable` con columnas nombre + especialidad / servicios asignados
  (badges; array vacío → `team.unassigned`) / sucursal / invitación (email + badge
  traducido `PENDING`/`ACCEPTED`) / acciones. Sin datos → `EmptyState` con CTA.
- `worker-row-actions.tsx`: DropdownMenu ⋯ → Editar / Reenviar invitación (solo si
  `PENDING`) / Eliminar (ítem destructive).
- `worker-form-sheet.tsx` + `worker-form-fields.tsx`: campos `fullName`, `specialty`,
  `invitedEmail` (email opcional, solo alta) y `branchId` (Select con "Sin sucursal" →
  `null` + sucursales de `api.branch.list`
  del router F2). Validación con `workerFormSchema` (Zod, en `team.schema.ts`, espejo del
  input de F6-08) antes de mutar.
- `use-team-mutations.ts`: `create/update/delete/resendInvitation` con toast por código de error
  (`errors.json` / `dashboard.json:team.errors`) e `invalidate` de `team.list`.
  `CONFLICT` en delete → toast específico `team.errors.CONFLICT`
  ("Es el único trabajador asignado a un servicio activo; reasigna el servicio primero").
- Eliminar: `ConfirmDialog` con nombre del trabajador.
- `loading.tsx`: skeleton fiel (header + tabla de ~5 filas). `error.tsx`: mensaje + botón
  retry (`reset()`).
- Botón deshabilitado + tooltip/nota cuando `limit.canCreate === false` (límite alcanzado
  o cuenta sin plan/ACTIVE); el servidor sigue siendo la autoridad.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Nada se importa desde el `_components/` de otro módulo; sin animaciones (dashboard sobrio).

## Criterios de aceptación

- [ ] CRUD completo con toasts; `PLAN_LIMIT_REACHED` y `CONFLICT` muestran su mensaje
      traducido específico.
- [ ] Alta con email muestra «Invitación enviada» y permite reenviar; copy completo es/en.
- [ ] Tabla cubre nombre, servicios y sucursal exigidos por la spec, más especialidad y
      estado D5; "Sin asignar" atenuado; sucursal "—" si null.
- [ ] Sheet/Dialog/Dropdown operables por teclado, focus visible; estados
      loading/empty/error presentes.
- [ ] Copy completo es/en; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Migración de `F6-07` aplicada y seed actualizado para ver datos en la tabla.
