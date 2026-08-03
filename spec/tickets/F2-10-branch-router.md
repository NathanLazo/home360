# [F2-10] Router `branch` y servicio de sucursales (W8, backend)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §4; `spec/00-foundations.md` §3–§5; `spec/04-subscriptions.md` §3
- **Depende de**: F2-01 (`ACTIVE_ORDER_STATUSES`), F2-02 (`assertPlanLimit`)
- **Tamaño estimado**: M

## Contexto

CRUD de sucursales con límite de plan (`maxBranches`) y contador de uso para el header
"3 de 5 disponibles en tu plan".

**Problemas detectados en la spec, resueltos aquí:**

1. `update` / `setStatus` / `delete` aparecen como "análogos" sin inputs. Resolución:
   inputs exactos definidos abajo; todos con `NOT_FOUND` para ids ajenos.
2. `monthlyOrders` no define el periodo. Resolución: órdenes del **mes calendario en
   curso** (desde `startOfMonth(now)`, hora del servidor) — coincide con la etiqueta
   "órdenes/mes" del diseño; no usa la ventana de 30 días de W3, documentar en código.
3. La spec no dice qué cuenta `maxBranches`. Resolución: **todas** las sucursales (activas
   y pausadas) — pausar no libera cupo (coherente con F2-02).
4. Borrar la sucursal seleccionada en `?branch=` deja un id huérfano en la URL: el
   `BranchSelector` (F2-01) ya cae a "Todas" y las procedures responden `NOT_FOUND`; la
   UI de F2-11 debe limpiar el param tras un delete exitoso.

## Alcance

Crear:

- `src/server/api/routers/branch.ts`
- `src/server/services/business/branch-directory.ts`
- `src/app/[locale]/dashboard/branches/_components/branch.schema.ts`

Fuera de alcance: UI (F2-11), registro en `appRouter` (F2-14), mapa de cobertura real,
cambios de schema.

## Detalle técnico

Lecturas `businessProcedure`; mutations `activeBusinessProcedure`.

### Schemas

```ts
export const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(160),
  managerName: z.string().trim().min(2).max(80).optional(),
  coverageRadiusKm: z.number().int().min(1).max(100),
});
export const branchUpdateSchema = /* id cuid + parciales de lo anterior */;
export const branchSetStatusSchema = z.object({ id: z.string().cuid(), status: z.nativeEnum(BranchStatus) });
```

### Procedures

| Procedure | Proc | Comportamiento |
|-----------|------|----------------|
| `list` | business | Sin paginación (cardinalidad baja). Si `ctx.business.subscription` es `null`, retorna `BUSINESS_NOT_ACTIVE` (no confundir ausencia de plan con plan ilimitado). `branch.findMany({ where: { businessId } })` con `select` mínimo + `order.groupBy` del mismo `businessId` y mes. Result: `{ items: Array<{ id, name, address, managerName: string \| null, status, coverageRadiusKm, monthlyOrders }>, limits: { used: number, max: number \| null } }`; `max: null` significa únicamente plan ilimitado |
| `create` | active | `assertPlanLimit(db, ctx.business, "branches")` → crear (status default ACTIVE) → `{ id }` · `PLAN_LIMIT_REACHED` |
| `update` | active | `update({ where: { id, businessId } })`; `P2025` → `NOT_FOUND` → `{ id }` |
| `setStatus` | active | `update({ where: { id, businessId } })` → `{ id, status }` · `NOT_FOUND` |
| `delete` | active | En transacción: `NOT_FOUND`; `CONFLICT` (409) si `order.count({ where: { businessId, branchId: id, status: { in: ACTIVE_ORDER_STATUSES } } }) > 0`; si no, `delete({ where: { id, businessId } })` (históricas quedan `branchId: null`) → `{ id }` |

Servicio `branch-directory.ts` con la lógica (recibe `db` y `business` del ctx); router
delgado con `ok`/`fail`/`normalizeError`. Inputs derivados con `z.infer`; payloads de
Prisma con `Prisma.BranchGetPayload` y `select` mínimo, sin `any` ni casts amplios.

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
- [ ] Con seed (plan standard, 3 sucursales): `limits` = `{ used: 3, max: 5 }`.
- [ ] Crear sucursal 6 en plan standard (tras crear 2 más) → `PLAN_LIMIT_REACHED`.
- [ ] Imposible tocar sucursales de otro negocio.
- [ ] Negocio sin suscripción obtiene `BUSINESS_NOT_ACTIVE`; `max: null` queda reservado
      para un plan realmente ilimitado.

## Comandos para Roger (si aplica)

—
