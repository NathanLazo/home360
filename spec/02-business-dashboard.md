# F2 — Dashboard de negocio

Cubre **W3 (inicio)**, **W4 (servicios)**, **W5 (productos)**, **W8 (sucursales)** y la
lista de órdenes del sidebar. Requiere F1. Los pagos reales llegan en F3; aquí las
columnas de dinero leen datos del seed.

## 0. Transversales del área dashboard

- `dashboard/layout.tsx` (Server Component): valida rol, carga negocio + conteo de órdenes
  activas (badge del sidebar) y sucursales; renderiza `AppSidebar variant="light"` +
  header con `BranchSelector` y `LocaleSwitcher`.
- **`BranchSelector`** (`src/components/branch-selector.tsx`, client): Select con "Todas
  las sucursales" + lista; escribe `?branch=<id>` en la URL (searchParams como única
  fuente de verdad — sin context ni estado global). Cada página lee `searchParams.branch`
  y lo pasa a sus queries. Server-side se valida que la sucursal pertenezca a
  `ctx.business.id`.
- Patrón de datos: `page.tsx` hace prefetch con el helper server de tRPC
  (`~/trpc/server`) + `HydrateClient`; las vistas cliente usan `api.<router>.<proc>.useQuery`.
- Todas las procedures de esta fase usan `businessProcedure` (lecturas) o
  `activeBusinessProcedure` (mutaciones).

## 1. W3 — Inicio `/dashboard`

### Router `dashboard`

| Procedure | Input | Result |
|-----------|-------|--------|
| `getKpis` (query) | `{ branchId?, days: 30 }` | `{ revenueCents, revenueDeltaPct, ordersCount, serviceOrders, productOrders, escrowCents, escrowOrders, avgRating, reviewsCount }` |
| `getWeeklyRevenue` (query) | `{ branchId?, weeks: 8 }` | `Array<{ weekStart, servicesCents, productsCents }>` |
| `getOrdersByBranch` (query) | `{ days: 30 }` | `Array<{ branchId, branchName, ordersCount }>` |
| `getRecentOrders` (query) | `{ branchId?, limit: 5 }` | `Array<{ id, folio, title, customerName, branchName, amountCents, status }>` |

Servicio `src/server/services/dashboard/business-kpis.ts`: agregaciones Prisma
(`aggregate`/`groupBy`) sobre `Payment` (revenue = pagos `IN_ESCROW|RELEASED` del
periodo), `Order` y `Review`. Delta = periodo actual vs. anterior.

### Módulo

```text
dashboard/page.tsx  +  _components/
├─ dashboard-view.tsx           # grid: 4 KPIs / gráfica + órdenes por sucursal / tabla
├─ kpi-row.tsx                  # 4 × KpiCard (ingresos, órdenes, escrow, calificación)
├─ weekly-revenue-chart.tsx     # "use client": Recharts barras apiladas + Tabs Servicios/Productos
├─ orders-by-branch-list.tsx    # barras horizontales simples por sucursal
├─ recent-orders-table.tsx      # DataTable con StatusBadge; link "Ver todas" → /dashboard/orders
└─ dashboard.types.ts
```

## 2. W4 — Servicios `/dashboard/services`

### Router `service`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` (query) | `{ search?, category?, status?, cursor? }` | `{ items: ServiceListItem[], nextCursor }` — incluye nombres de workers |
| `create` (mutation) | `serviceCreateSchema` (name, category, basePriceCents, durationMinutes, durationMaxMinutes?, workerIds[]) | `{ id }` |
| `update` (mutation) | `serviceUpdateSchema` (id + parciales) | `{ id }` · `NOT_FOUND` |
| `setStatus` (mutation) | `{ id, status }` | `{ id, status }` |
| `delete` (mutation) | `{ id }` | `{ id }` · `CONFLICT` si tiene órdenes activas |
| `listWorkers` (query) | — | `Array<{ id, fullName }>` (para el multiselect del form) |

Servicio `src/server/services/catalog/service-catalog.ts`. `workerIds` se valida contra
los workers del negocio (`connect` filtrado por `businessId`).

### Módulo (patrón de referencia — se replica en products/branches)

```text
services/  page.tsx · loading.tsx · error.tsx  +  _components/
├─ services-view.tsx            # header + filtros + tabla + sheet (estado abierto/editando)
├─ services-table.tsx           # columnas: servicio, categoría, precio desde, duración, trabajadores, estado
├─ service-row-actions.tsx      # DropdownMenu ⋯: editar / pausar-activar / eliminar
├─ service-form-sheet.tsx       # Sheet lateral crear/editar
├─ service-form-fields.tsx      # inputs presentacionales (recibe register/errors)
├─ service-status-badge.tsx     # Activo (verde) / Pausado (ámbar)
├─ service-filters.tsx          # búsqueda + Select categoría + Select estado
├─ service.schema.ts · service.types.ts
└─ use-service-mutations.ts     # create/update/setStatus/delete + toast + invalidate
```

UX: "Nuevo servicio" abre el Sheet; eliminar pasa por `ConfirmDialog`; "Sin asignar" en
trabajadores se muestra atenuado (diseño W4); precios con Geist Mono.

## 3. W5 — Productos `/dashboard/products`

### Router `product`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` (query) | `{ search? (nombre o SKU), category?, status?, lowStockOnly?, cursor? }` | `{ items, nextCursor, totals: { count, lowStockCount } }` |
| `create` (mutation) | `productCreateSchema` | `{ id }` · `SKU_TAKEN` (409) · `PLAN_LIMIT_REACHED` |
| `update` (mutation) | id + parciales | `{ id }` |
| `setStatus` (mutation) | `{ id, status: DRAFT\|PUBLISHED }` | `{ id, status }` · `PLAN_LIMIT_REACHED` al publicar |
| `importCsv` (mutation) | `{ rows: productCsvRowSchema[] }` (máx. 500) | `{ created, updated, errors: Array<{ line, code }> }` |
| `delete` (mutation) | `{ id }` | `{ id }` |

- **Límite de plan**: `assertPlanLimit` (servicio compartido
  `src/server/services/subscription/plan-limits.ts`, se implementa aquí y se reusa en F4):
  cuenta productos `PUBLISHED` vs. `ctx.business.plan.maxProducts` → `PLAN_LIMIT_REACHED`.
- **Import CSV**: el archivo se parsea **en el cliente** (`papaparse`), se valida fila por
  fila con Zod y se envía ya tipado; upsert por `(businessId, sku)` en transacción.
  El estado "Stock bajo" del diseño es **derivado** (`stock <= lowStockThreshold`), no un
  enum persistido.

### Módulo

Mismo patrón que services, más:

```text
├─ product-import-dialog.tsx    # Dialog: dropzone → preview (primeras 10 filas + errores) → confirmar
├─ product-csv.utils.ts         # parse + mapeo de columnas → productCsvRowSchema
└─ product-stock-cell.tsx       # stock con punto ámbar si bajo
```

Header muestra "248 productos · 12 con stock bajo" (de `totals`); toggle "Stock bajo"
como filtro chip.

## 4. W8 — Sucursales `/dashboard/branches`

### Router `branch`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` (query) | — | `Array<{ id, name, address, managerName, status, coverageRadiusKm, monthlyOrders }>` + `{ used, max }` |
| `create` (mutation) | `{ name, address, managerName?, coverageRadiusKm }` | `{ id }` · `PLAN_LIMIT_REACHED` |
| `update` / `setStatus` / `delete` (mutations) | análogos | `CONFLICT` si tiene órdenes activas (delete) |

### Módulo

Cards en grid (no tabla): nombre, dirección, encargado, órdenes/mes, `StatusBadge`
Activa/Pausada, acciones ⋯. Header: "3 de 5 disponibles en tu plan" (`used/max`; máx.
`null` → "ilimitadas"). `branch-form-sheet.tsx` para alta/edición. El mapa de cobertura
del diseño se representa como placeholder estático (`branch-coverage-map.tsx`) — mapa
real fuera de alcance.

## 5. Órdenes `/dashboard/orders`

### Router `order`

| Procedure | Input | Result |
|-----------|-------|--------|
| `list` (query) | `{ branchId?, status?, type?, search?, cursor? }` | items con folio, título, cliente, sucursal, monto, estado, fecha |
| `getById` (query) | `{ id }` | detalle completo (cliente, pago, servicio/producto, grabación) |

Solo lectura en esta fase (las órdenes nacen en la app móvil / seed; las transiciones de
pago llegan en F3). Vista: tabla con filtros por estado/tipo + `order-detail-sheet.tsx`
(Sheet al hacer clic en fila, con timeline de estado).

## 6. Pruebas

- `business-kpis.test.ts`: agregaciones con fake de Prisma (delta %, split servicios/productos).
- `plan-limits.test.ts`: límite alcanzado / ilimitado (`null`) / por debajo.
- `service-catalog.test.ts`: create con workers de otro negocio → rechazo.
- `product-csv.utils.test.ts`: filas inválidas reportan línea y código.

## 7. Verificación

1. `pnpm typecheck` · `pnpm check` · `pnpm vitest run`.
2. Con seed: KPIs de "Plomería García" coinciden con los datos sembrados; selector de
   sucursal filtra KPIs, gráfica y tablas; CRUD completo de servicio/producto/sucursal
   con toasts; import CSV con archivo de 20 filas (2 inválidas) reporta errores por línea;
   publicar el producto 51 en plan básico → toast `PLAN_LIMIT_REACHED`.

### Criterios de aceptación

- [ ] Las 4 pantallas replican columnas, contadores y estados del diseño W3/W4/W5/W8.
- [ ] Todo dato filtrado por `ctx.business.id` en la consulta; imposible ver datos ajenos.
- [ ] Sheets/Dialogs/Dropdowns operables con teclado; focus visible.
- [ ] Montos siempre `Intl` MXN desde centavos; folios/SKU en Geist Mono.
- [ ] Estados loading (skeletons), empty y error en cada módulo.
