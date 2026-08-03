# [F2-04] W3 — UI de inicio `/dashboard` (KPIs, gráfica, tablas)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §0–§1; `spec/00-foundations.md` §7
- **Depende de**: F2-01, F2-03, F2-14 (routers registrados en `appRouter`)
- **Tamaño estimado**: M

## Contexto

Vista W3: 4 KPIs, gráfica de revenue semanal apilada (Recharts), barras por sucursal y
tabla de órdenes recientes. Consume el router `dashboard` de F2-03. Patrón de datos de la
spec §0: `page.tsx` hace prefetch server (`~/trpc/server` + `HydrateClient`) y los
componentes cliente usan `api.dashboard.<proc>.useQuery`.

Notas de resolución: `customerName`/`branchName` pueden ser `null` (schema F0) — la UI
muestra "—" / clave `dashboard.home.noBranch`; `revenueDeltaPct: null` → sin delta ("—").

## Alcance

Crear bajo `src/app/[locale]/dashboard/`:

- `page.tsx` · `loading.tsx` · `error.tsx`
- `_components/dashboard-view.tsx`
- `_components/kpi-row.tsx`
- `_components/weekly-revenue-chart.tsx`
- `_components/orders-by-branch-list.tsx`
- `_components/recent-orders-table.tsx`
- `_components/dashboard.types.ts`
- Claves nuevas en `src/messages/{es,en}/dashboard.json`

Fuera de alcance: cualquier procedure nueva; componentes compartidos (`KpiCard`,
`DataTable`, `StatusBadge` ya existen de F0 — si falta alguno, es bloqueo de F0, no se
crea aquí un duplicado local). En `dashboard.json`, modificar solo `dashboard.home.*` y
crear una vez `dashboard.orderStatus.*`; no tocar namespaces de otros módulos.

## Detalle técnico

- **`page.tsx`** (Server Component): lee `searchParams` con `parseBranchParam` (F2-01),
  prefetch de `getKpis`, `getWeeklyRevenue`, `getOrdersByBranch`, `getRecentOrders` con
  ese `branchId`, envuelve en `HydrateClient` y renderiza `<DashboardView branchId={…} />`.
- **`dashboard-view.tsx`**: grid responsive — fila de 4 KPIs / fila con gráfica (2/3) +
  `orders-by-branch-list` (1/3) / tabla de recientes. Componente de composición sin
  fetch propio. Cada consumidor tRPC lee el sobre `TrpcResponse`: renderiza
  `response.result` solo cuando no es `null`; un `response.error` se traduce con
  `errors.<code>` y se presenta como estado de error recuperable. Un contrato fallido
  llega como respuesta exitosa de transporte, por lo que no se delega únicamente a
  `query.error`.
- **`kpi-row.tsx`**: 4 × `KpiCard` (F0): ingresos (`revenueCents` → MXN + delta %),
  órdenes (`ordersCount`, subtexto split servicios/productos), escrow (`escrowCents` +
  `escrowOrders`), calificación (`avgRating` + `reviewsCount`). Montos con
  `useFormatter()` de next-intl (MXN, `cents / 100`); `avgRating null` → "—".
- **`weekly-revenue-chart.tsx`** (`"use client"`): Recharts `BarChart` apilado
  (`servicesCents` + `productsCents`) sobre el wrapper `chart` de shadcn; `Tabs`
  Servicios/Productos/Todo (Todo = apilado; cada tab filtra la serie). Eje Y en MXN
  abreviado; tooltip con formato completo.
- **`orders-by-branch-list.tsx`**: barras horizontales simples (div con width %) por
  sucursal, ordenadas desc; bucket `branchId: null` → label `dashboard.home.noBranch`.
- **`recent-orders-table.tsx`**: `DataTable` (F0) con columnas folio (`#<folio>`, Geist
  Mono), título, cliente, sucursal, monto (MXN, Geist Mono), estado (`StatusBadge` con el
  mapa `OrderStatus → variante`); link "Ver todas" → `/dashboard/orders` (respetando
  locale y `?branch`).
- **Estados**: `loading.tsx` con skeletons de la misma grid; `error.tsx` client con
  mensaje traducido + botón reintentar; queries vacías → `EmptyState` (F0).
- **i18n** — claves nuevas bajo `dashboard.home.*`: títulos de KPIs, tabs de la gráfica,
  encabezados de tabla, `noBranch`, `viewAll`, `empty*`. Estados de orden bajo
  `dashboard.orderStatus.*` (PENDING…DISPUTED) — namespace compartido con F2-13, crearlo
  aquí completo.

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
- [ ] Con seed: la vista replica columnas, contadores y estados del diseño W3.
- [ ] Cambiar sucursal en el selector re-filtra KPIs, gráfica y tablas (vía URL).
- [ ] Montos siempre `Intl` MXN desde centavos; folios en Geist Mono.
- [ ] Skeleton, empty y error visibles según el estado de datos.
- [ ] Nada importado desde `_components/` de otro módulo.
- [ ] Ningún componente trata el sobre `TrpcResponse` como si fuera el resultado directo.

## Comandos para Roger (si aplica)

—
