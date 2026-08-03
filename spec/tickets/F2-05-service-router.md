# [F2-05] Router `service` y servicio de catálogo (W4, backend)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §2; `spec/00-foundations.md` §3–§5
- **Depende de**: F2-01 (`ACTIVE_ORDER_STATUSES`)
- **Tamaño estimado**: M

## Contexto

CRUD del catálogo de servicios del negocio, con asignación de trabajadores (m2m
`Service.workers`).

**Problemas detectados en la spec, resueltos aquí:**

1. La spec no lista `NOT_FOUND` para `setStatus`/`delete` (solo para `update`).
   Resolución: toda mutation por `id` responde `NOT_FOUND` si el servicio no existe **o
   no pertenece al negocio** (mismo mensaje, sin revelar existencia ajena).
2. "CONFLICT si tiene órdenes activas" no define "activa". Resolución: usar
   `ACTIVE_ORDER_STATUSES` de F2-01.
3. El filtro de categoría del UI necesita opciones y la spec no define de dónde salen
   (`category` es `String` libre). Resolución: query adicional `listCategories`
   (distinct por negocio), también usada como sugerencias en el form.
4. Los servicios **no** están ligados a sucursal (sin relación en schema): `list` no
   acepta `branchId`; el selector de sucursal no aplica en W4 (ver F2-01).

## Alcance

Crear:

- `src/server/api/routers/service.ts`
- `src/server/services/catalog/service-catalog.ts`
- `src/app/[locale]/dashboard/services/_components/service.schema.ts`

Fuera de alcance: UI (F2-06), registro en `appRouter` (F2-14), CRUD de `Worker` (llega
en F6), cambios de schema.

## Detalle técnico

Lecturas con `businessProcedure`; mutations con `activeBusinessProcedure`. Los schemas
Zod viven junto al router o en el `_components/service.schema.ts` del módulo UI **solo**
si los comparte el cliente (el form los reusa: colocarlos en
`src/app/[locale]/dashboard/services/_components/service.schema.ts` e importarlos desde el
router es el patrón de la spec §2 — schema del form y del router son el mismo archivo).

### Schemas

```ts
export const serviceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  basePriceCents: z.number().int().positive(),
  durationMinutes: z.number().int().positive().max(24 * 60),
  durationMaxMinutes: z.number().int().positive().max(7 * 24 * 60).optional(),
  workerIds: z.array(z.string().cuid()).max(50).default([]),
}).refine((v) => v.durationMaxMinutes === undefined || v.durationMaxMinutes >= v.durationMinutes,
  { path: ["durationMaxMinutes"] });

export const serviceUpdateSchema = /* id: cuid + todos los campos anteriores opcionales,
  misma refine cuando ambos duration están presentes */;

export const serviceListSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  cursor: z.string().cuid().optional(),
});
```

### Procedures

| Procedure | Proc | Comportamiento |
|-----------|------|----------------|
| `list` | business | Paginación por cursor (patrón común: `take: 21`, `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`, `cursor: { id }`, `skip: 1` con cursor; `nextCursor` = id del item 21 si existe). Si llega cursor, validar primero con `findFirst({ where: { id: cursor, businessId } })`; ajeno/inexistente → `NOT_FOUND`. `search` → `name contains insensitive`. Incluye `workers: { select: { id, fullName } }`. Result: `{ items: ServiceListItem[], nextCursor: string \| null }` |
| `listCategories` | business | `groupBy(["category"])` del negocio, orden alfabético → `string[]` |
| `listWorkers` | business | `worker.findMany({ where: { businessId }, select: { id, fullName } })` |
| `create` | active | Ver validación de workers abajo → `{ id }` |
| `update` | active | En transacción: `findFirst({ where: { id, businessId }, select mínimo })` → `NOT_FOUND`; validar contra el registro actual que `durationMaxMinutes >= durationMinutes` incluso si solo cambió uno; validar workers y actualizar con `where: { id, businessId }`. `workers.set` reemplaza el conjunto cuando `workerIds` viene definido → `{ id }` |
| `setStatus` | active | `{ id, status: z.nativeEnum(ServiceStatus) }`; `update({ where: { id, businessId } })` y mapear `P2025` a `NOT_FOUND` → `{ id, status }` |
| `delete` | active | En transacción: `NOT_FOUND` si no es del negocio; `CONFLICT` (409) si `order.count({ where: { businessId, serviceId: id, status: { in: ACTIVE_ORDER_STATUSES } } }) > 0`; si no, `delete({ where: { id, businessId } })` → `{ id }` |

**Validación de workers** (create y update): si `workerIds.length > 0`,
`worker.count({ where: { id: { in: workerIds }, businessId } })`; si el conteo no
coincide → `fail("VALIDATION_ERROR", 422, "Some workers do not belong to the business")`.
Conexión con `connect` de ids ya validados (create) o `set` (update). Todo dentro del
servicio `service-catalog.ts`; validación y escritura comparten transacción para evitar
una carrera entre ambas. El router solo orquesta contrato + `normalizeError`. Los tipos de
filas seleccionadas se derivan con `Prisma.ServiceGetPayload` y los inputs con
`z.infer`; no se duplican shapes ni se usa `any`.

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
- [ ] Imposible leer/mutar servicios de otro negocio (siempre `NOT_FOUND`/filtrado).
- [ ] `delete` de servicio con orden activa del seed → `CONFLICT`.
- [ ] Todas las procedures retornan `TrpcResponse`; errores como códigos estables.
- [ ] Cursor ajeno y mutations sobre ids ajenos devuelven `NOT_FOUND`; cada query de
      lectura/escritura incluye `businessId` tomado de sesión.

## Comandos para Roger (si aplica)

—
