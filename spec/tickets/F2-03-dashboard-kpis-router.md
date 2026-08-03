# [F2-03] Router `dashboard` y servicio de KPIs de negocio (W3, backend)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §1; `spec/00-foundations.md` §3–§5; `spec/03-payments.md` §1 (semántica de `PaymentStatus`)
- **Depende de**: F2-01 (`assertBranchInBusiness`, `ACTIVE_ORDER_STATUSES`), `XC-25`
- **Tamaño estimado**: L

## Contexto

Backend de W3: 4 queries de agregación sobre `Payment`, `Order` y `Review`. En F2 los
datos de dinero provienen del seed (los pagos reales llegan en F3).

**Problemas detectados en la spec, resueltos aquí:**

1. `Payment` no tiene `businessId`: todo filtro de tenant/sucursal se hace vía la relación
   `order: { businessId, branchId }` (el filtro de tenant queda dentro de la query, como
   exige el contrato).
2. Los inputs traen literales (`days: 30`, `weeks: 8`, `limit: 5`). Resolución: son
   **defaults Zod** con rangos acotados (ver schemas abajo).
3. `revenueDeltaPct` no define el caso "periodo anterior = 0". Resolución: el campo es
   `number | null`; `null` cuando no hay base de comparación y la UI muestra "—".
4. La agrupación semanal por `weekStart` con split por `Order.type` **no** es expresable
   con `groupBy` de Prisma (no hay `date_trunc` ni group por campo relacionado).
   Resolución: `findMany` con `select` mínimo del rango (`createdAt`, `amountCents`,
   `order: { type }`) y bucketing en memoria en el servicio (semanas inician lunes,
   dataset acotado a 8 semanas de un negocio). Sin `$queryRaw`, para mantener el servicio
   testeable con fakes.
5. Órdenes con `branchId: null` (sucursal borrada, `onDelete: SetNull`). Resolución:
   `getOrdersByBranch` incluye un bucket `branchId: null` que la UI etiqueta con la clave
   i18n `dashboard.home.noBranch`; `branchName` es `string | null` en los resultados.
6. Revenue del proveedor usa `providerAmountCents`, nunca `amountCents` (que incluye la
   tarifa plana). En F2 incluye `IN_ESCROW | RELEASED`; `PARTIALLY_REFUNDED` queda excluido
   hasta que Roger cierre `PENDIENTES.md` §1–§2. `XC-27`, serializado después de este
   ticket, incorpora ese estado con la política aprobada sin bloquear el resto de F2.
7. La verificación §7 exige que el selector filtre "tablas", pero `getOrdersByBranch` no
   aceptaba sucursal. Resolución: también recibe `branchId?`; al seleccionarla devuelve
   solo su bucket. En "Todas" conserva el desglose completo.

## Alcance

Crear:

- `src/server/api/routers/dashboard.ts`
- `src/server/services/dashboard/business-kpis.ts`

Fuera de alcance: UI de W3 (F2-04), registro en `appRouter` (F2-14), cambios de schema.

## Detalle técnico

Todas las procedures usan `businessProcedure` (solo lecturas). Cada una con `branchId`:
si viene definido, `assertBranchInBusiness`; falso → `fail("NOT_FOUND", 404, …)`.

### Schemas Zod de input

```ts
const branchScopedSchema = z.object({
  branchId: z.string().cuid().optional(),
});
const getKpisSchema = branchScopedSchema.extend({
  days: z.number().int().min(1).max(365).default(30),
});
const getWeeklyRevenueSchema = branchScopedSchema.extend({
  weeks: z.number().int().min(1).max(26).default(8),
});
const getOrdersByBranchSchema = branchScopedSchema.extend({
  days: z.number().int().min(1).max(365).default(30),
});
const getRecentOrdersSchema = branchScopedSchema.extend({
  limit: z.number().int().min(1).max(20).default(5),
});
```

### Servicio `business-kpis.ts`

Funciones de dominio que reciben `db` por parámetro:

```ts
getBusinessKpis(db, businessId, { branchId, days }): Promise<BusinessKpis>
getWeeklyRevenue(db, businessId, { branchId, weeks }): Promise<WeeklyRevenuePoint[]>
getOrdersByBranch(db, businessId, { branchId, days }): Promise<OrdersByBranchRow[]>
getRecentOrders(db, businessId, { branchId, limit }): Promise<RecentOrderRow[]>
```

**`getBusinessKpis`** — periodo actual `[now − days, now]`, anterior
`[now − 2·days, now − days)`:

- `revenueCents`: `payment.aggregate({ _sum: { providerAmountCents } })` con
  `where: { status: { in: ["IN_ESCROW", "RELEASED"] }, createdAt: rango, order: { businessId, ...(branchId && { branchId }) } }`.
- `revenueDeltaPct: number | null`: `prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)`.
- `ordersCount` / `serviceOrders` / `productOrders`: `order.groupBy({ by: ["type"], _count: true })`
  filtrado por `businessId`, rango y sucursal.
- `escrowCents` + `escrowOrdersCount`: `payment.aggregate` `_sum.amountCents` y `_count`
  con `status: "IN_ESCROW"` (bruto cobrado, sin filtro de fecha). El nombre del conteo es
  el contrato uniforme de `XC-27`.
- `avgRating` (`number | null`, 1 decimal) + `reviewsCount`:
  `review.aggregate({ _avg: { rating }, _count: true, where: { order: { businessId, ... } } })`,
  sin filtro de fecha (rating acumulado, como el diseño).

**`getWeeklyRevenue`** — `findMany` de pagos `IN_ESCROW|RELEASED` desde el lunes de hace
`weeks − 1` semanas, `select: { providerAmountCents: true, createdAt: true, order: { select: { type: true } } }`;
bucketing en memoria → `Array<{ weekStart: Date; servicesCents: number; productsCents: number }>`
con exactamente `weeks` entradas (semanas sin datos = 0).

**`getOrdersByBranch`** — `order.groupBy({ by: ["branchId"], _count: true })` del rango,
siempre con `businessId` y con `branchId` cuando se seleccionó una sucursal, +
resolución de nombres con un `branch.findMany({ where: { businessId } })`; ordenar desc
por conteo → `Array<{ branchId: string | null; branchName: string | null; ordersCount: number }>`.

**`getRecentOrders`** — `order.findMany` con `take: limit`,
`orderBy: [{ createdAt: "desc" }, { id: "desc" }]`, `select` mínimo con
`customer: { select: { name } }` y `branch: { select: { name } }` →
`Array<{ id; folio: number; title; customerName: string | null; branchName: string | null; amountCents; status: OrderStatus; createdAt: Date }>`
(`User.name` es anulable en el schema — la UI resuelve el fallback).

### Router `dashboard.ts`

Cuatro queries, cada una: valida branch → llama servicio → `ok(result, "…")`. `catch` con
`normalizeError`. Tipos de resultado exportados desde el servicio (no duplicar). Definir
los payloads internos con `Prisma.PaymentGetPayload`, `Prisma.OrderGetPayload` y
`Prisma.ReviewGetPayload` parametrizados por sus `select`; no usar objetos escritos a mano
para representar filas Prisma ni casts amplios.

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
- [ ] Con seed: KPIs de "Plomería García" coinciden con los datos sembrados; `branchId`
      filtra revenue, órdenes y recientes; `branchId` ajeno → `NOT_FOUND`.
- [ ] Ninguna procedure acepta `businessId` por input.
- [ ] `revenueDeltaPct === null` cuando el periodo anterior no tiene revenue.
- [ ] Con una sucursal seleccionada, `getOrdersByBranch` solo devuelve su bucket; en
      "Todas" devuelve el desglose completo.

## Comandos para Roger (si aplica)

—
