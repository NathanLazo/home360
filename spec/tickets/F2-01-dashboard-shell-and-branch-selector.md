# [F2-01] Shell del dashboard: layout, BranchSelector y helper de sucursal

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §0 (transversales); `spec/00-foundations.md` §5, §7
- **Depende de**: F0 y F1 completos (schema migrado, procedures por rol, `AppSidebar`, next-intl)
- **Tamaño estimado**: M

## Contexto

Todas las vistas de F2 viven bajo `[locale]/dashboard/` y comparten: sidebar claro con
badge de órdenes activas, header con selector de sucursal (`?branch=<id>` en la URL) y
`LocaleSwitcher`. Este ticket construye ese esqueleto y las utilidades transversales que
consumen el resto de tickets (validación server-side de pertenencia de sucursal, parsing
del searchParam, definición canónica de "orden activa").

**Problemas detectados en la spec, resueltos aquí:**

1. La spec §0 dice "cada página lee `searchParams.branch` y lo pasa a sus queries", pero no
   todas las entidades tienen sucursal. Resolución, alineada con la decisión de inventario
   de `F0-12`:
   - **Filtran por sucursal**: W3 inicio (KPIs), órdenes y **W5 productos** — el inventario
     vive en `ProductStock` (producto × sucursal), así que el stock mostrado depende de la
     sucursal activa.
   - **No filtran**: W4 servicios (son capacidades del negocio; su cobertura se deriva del
     radio de la sucursal y de los trabajadores asignados, no de una relación propia) y W8
     sucursales (es la lista de sucursales en sí).
   El selector vive en el header de toda el área y persiste en la URL al navegar; las vistas
   que lo ignoran lo documentan con un comentario en código.
2. La spec no define qué pasa si `?branch` no pertenece al negocio. Resolución: helper
   server `assertBranchInBusiness`; las procedures responden `fail("NOT_FOUND", 404, …)`.
3. "Órdenes activas" (badge del sidebar, checks de CONFLICT en deletes) no está definido.
   Resolución canónica: `OrderStatus ∈ { PENDING, PAID, IN_PROGRESS, SHIPPING, DISPUTED }`
   (todo lo que no sea `COMPLETED` ni `CANCELLED`), exportado como constante única.

## Alcance

Crear:

- `src/app/[locale]/dashboard/layout.tsx`
- `src/components/branch-selector.tsx`
- `src/components/dashboard-sidebar.tsx`
- `src/server/services/business/branch-access.ts`
- `src/server/services/business/order-activity.ts`
- `src/lib/search-params.ts` (helper `parseBranchParam`)

Modificar:

- `src/messages/{es,en}/dashboard.json` (si ya existe de F0, solo agregar claves)

Fuera de alcance: páginas hijas (`page.tsx` de cada vista), routers tRPC de F2, cualquier
cambio de schema (F2 no requiere migraciones). En `dashboard.json`, este ticket solo
modifica `dashboard.branchSelector.*`, `dashboard.nav.*` y `dashboard.header.*`.

## Detalle técnico

### `layout.tsx` (Server Component)

1. `const session = await auth()`; sin sesión o `role !== "BUSINESS"` → `redirect` a
   `/login` o a la home del rol (mismo criterio que F1 §3).
2. Carga en paralelo mediante funciones de servicio (el layout no importa Prisma ni arma
   queries; esta es la única excepción al cliente tRPC porque es un Server Component de
   autorización/composición):
   - negocio del owner (`select: { id, name, status }`),
   - `countActiveOrders(db, businessId)` (badge del sidebar),
   - sucursales (`select: { id, name }`, orden alfabético) para el `BranchSelector`.
   El negocio se resuelve exclusivamente desde `session.user.id`; ninguna función acepta
   un `businessId` proveniente de URL, props del cliente o search params.
3. Render: `AppSidebar variant="light"` con items W3/W4/W5/W6*/W7*/W8/órdenes (las rutas
   de F3/F4 pueden quedar como items deshabilitados o ausentes hasta sus fases; decisión
   local, documentar) + header con `BranchSelector` y `LocaleSwitcher` + `{children}`.
   `dashboard-sidebar.tsx` es un wrapper cliente pequeño: lee `useSearchParams`, construye
   los `href` de navegación preservando `branch` y el resto de parámetros aplicables, y
   delega la presentación a `AppSidebar`. Esto hace verificable que navegar no borre la
   selección; el layout no puede leer search params cambiantes por sí solo.

### `src/server/services/business/order-activity.ts`

```ts
import type { OrderStatus } from "generated/prisma";
export const ACTIVE_ORDER_STATUSES = [
  "PENDING", "PAID", "IN_PROGRESS", "SHIPPING", "DISPUTED",
] as const satisfies readonly OrderStatus[];
export function countActiveOrders(db: PrismaClient, businessId: string): Promise<number>;
```

`countActiveOrders` = `db.order.count({ where: { businessId, status: { in: ACTIVE_ORDER_STATUSES } } })`.
Esta constante es la **única** definición de "orden activa" del proyecto (la reusan los
tickets F2-05, F2-10, F2-12).

### `src/server/services/business/branch-access.ts`

```ts
export async function assertBranchInBusiness(
  db: PrismaClient, businessId: string, branchId: string,
): Promise<boolean>;
```

`db.branch.count({ where: { id: branchId, businessId } }) > 0`. Las procedures que
reciben `branchId` opcional lo invocan y, si retorna `false`, responden
`fail("NOT_FOUND", 404, "Branch not found")` — nunca revelan si la sucursal existe en
otro negocio.

### `BranchSelector` (`"use client"`)

- Props: `branches: Array<{ id: string; name: string }>`.
- shadcn `Select` con primera opción "Todas las sucursales" (clave i18n
  `dashboard.branchSelector.all`) + una opción por sucursal.
- Lee el valor actual de `useSearchParams().get("branch")`; si el id no está en `branches`
  (p. ej. sucursal borrada), muestra "Todas".
- Al cambiar: `router.replace(pathname + "?" + params, { scroll: false })` preservando el
  resto de searchParams; opción "Todas" elimina el parámetro. Sin context ni estado global:
  la URL es la única fuente de verdad.

### `src/lib/search-params.ts`

```ts
export function parseBranchParam(searchParams: { branch?: string | string[] }): string | undefined;
```

Retorna `undefined` si falta, es array o string vacío. Cada `page.tsx` de F2 lo usa antes
de pasar `branchId` al prefetch.

### i18n

Claves nuevas (es/en): `dashboard.branchSelector.all`, `dashboard.branchSelector.label`,
`dashboard.nav.*` (labels del sidebar: inicio, servicios, productos, sucursales, órdenes),
`dashboard.header.*` si aplica.

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
- [ ] `/dashboard` sin sesión redirige a `/login`; con rol CUSTOMER/ADMIN redirige a su home.
- [ ] Sidebar claro muestra badge con el conteo de órdenes activas del seed.
- [ ] Cambiar sucursal escribe/borra `?branch=` sin recargar y preserva otros params.
- [ ] `?branch` persiste al navegar entre secciones del dashboard.
- [ ] Todo el copy sale de `dashboard.json` es/en; cero strings hardcodeados.

## Comandos para Roger (si aplica)

— (sin migraciones ni seed; F2 no cambia el schema)
