# F2 — Hallazgos de revisión de spec (no resolubles en tickets o que requieren decisión)

Revisión de `spec/02-business-dashboard.md` contra `spec/README.md`, `spec/00-foundations.md`,
`spec/01-auth.md`, `spec/03-payments.md` y `spec/04-subscriptions.md`. Los problemas ya
resueltos dentro de un ticket se listan al final como referencia con su resolución.

## Abiertos (requieren decisión de Roger o corrección de spec)

### A1. `papaparse` ausente de las dependencias de F0 — **Alta**

`spec/00-foundations.md` §2 solo instala `stripe bcryptjs next-intl recharts`, pero F2 §3
exige parseo CSV client-side con `papaparse`. El ticket F2-09 lo agrega
(`papaparse` + `@types/papaparse`), pero la spec F0 debería corregirse para que quien
implemente F0 desde cero no llegue a F2 con la dependencia faltante.
**Recomendación**: añadir `papaparse` (dep) y `@types/papaparse` (dev) a F0 §2, o una
nota en F2 §3 "instalar en esta fase".

### A2. Selector de sucursal "en todas las vistas" vs. schema sin relación — **Media**

F2 §0 dice que cada página lee `searchParams.branch` y lo pasa a sus queries, pero
`Service` y `Product` no tienen `branchId` en el schema F0 (solo `Order` lo tiene). El
filtro es imposible en W4/W5 y no aplica en W8. Resuelto por convención en F2-01 (el
param persiste en la URL pero solo filtra W3 y órdenes).
**Recomendación**: reescribir F2 §0 como "las vistas con datos por sucursal (inicio y
órdenes) leen `searchParams.branch`; el resto lo ignora". Si el negocio requiere stock o
catálogo por sucursal, es un cambio de schema mayor (relación Product/Service–Branch) que
debe decidirse antes de F3, no improvisarse en F2.

### A3. Revenue y pagos `PARTIALLY_REFUNDED` — **Media**

F2 §1 define revenue = pagos `IN_ESCROW | RELEASED`. Un pago con reembolso parcial pasa a
`PARTIALLY_REFUNDED` (F0/F3), por lo que **desaparece del revenue** aunque el negocio
retuvo `amountCents − refundedCents`. Los KPIs del seed (que incluye pagos reembolsados)
subreportarán ingresos. F2-03 implementa lo que dice la spec y no lo cambia.
**Recomendación**: decidir si revenue debe incluir `PARTIALLY_REFUNDED` con monto neto
(`amountCents − refundedCents`); si sí, actualizar F2 §1 y el test de `business-kpis`.

### A4. Trabajadores sin CRUD hasta F6 — **Baja** (informativo)

El multiselect de trabajadores de W4 (`service.listWorkers`) solo mostrará los 2 workers
del seed: el CRUD de `Worker` llega en F6 (`spec/06-landing-polish.md`, con
`assertPlanLimit("workers")`). No es un hueco de F2, pero la demo de W4 depende del seed.
**Recomendación**: ninguna acción en F2; considerar adelantar el CRUD de workers a F2 si
la demo lo requiere.

### A5. Órdenes y montos de F2 dependen 100 % del seed — **Baja** (informativo)

Los KPIs de W3 leen `Payment`, que no tiene flujo de escritura hasta F3. Ya está
reconocido en F2 ("las columnas de dinero leen datos del seed"); solo señalar que
cualquier validación manual de F2 §7 requiere `pnpm db:seed` ejecutado por Roger antes.

### A6. `Payment` sin índice por fecha — **Baja**

Las agregaciones de KPIs filtran por `Payment.createdAt` + relación `order`. F0 solo
indexa `Payment.status`. Con volumen real convendría `@@index([status, createdAt])`.
No se cambia el schema en F2 (regla de fase); anotar para la migración de F3.

## Resueltos en tickets (referencia)

| # | Problema | Resolución | Ticket |
|---|----------|------------|--------|
| R1 | `ctx.business.plan.maxProducts` (F2 §3) vs. forma real del ctx en F0 §5 (`subscription.plan`), y `subscription` anulable | Forma canónica F0; `subscription: null` → `BUSINESS_NOT_ACTIVE` | F2-02 |
| R2 | `product.create` lista `PLAN_LIMIT_REACHED` pero el límite cuenta solo `PUBLISHED` | Límite solo al crear como `PUBLISHED` o al publicar via `setStatus` | F2-07 |
| R3 | `SKU_TAKEN` no está en `ERROR_CODES` | Código de dominio `ProductErrorCode` vía genérico `TError` (patrón F0 §4) + clave en `errors.json` | F2-07 |
| R4 | `product.delete` sin regla `CONFLICT` (asimétrico con service/branch) | `CONFLICT` si órdenes activas referencian el producto | F2-07 |
| R5 | "Órdenes activas" sin definición (badge, CONFLICTs) | Constante única `ACTIVE_ORDER_STATUSES` = todo excepto `COMPLETED`/`CANCELLED` | F2-01 |
| R6 | `?branch` ajeno/huérfano sin comportamiento definido | `assertBranchInBusiness` → `NOT_FOUND`; selector cae a "Todas"; delete limpia la URL | F2-01, F2-10, F2-11 |
| R7 | Inputs con literales (`days: 30`, `weeks: 8`, `limit: 5`) | Defaults Zod con rangos acotados | F2-03 |
| R8 | `revenueDeltaPct` con periodo anterior = 0 | Tipo `number \| null`; UI muestra "—" | F2-03, F2-04 |
| R9 | Agrupación semanal con split por `Order.type` no expresable en `groupBy` de Prisma | `findMany` acotado + bucketing en memoria (sin `$queryRaw`, testeable) | F2-03 |
| R10 | `getOrdersByBranch` y órdenes con `branchId: null` (SetNull) | Bucket "Sin sucursal" con label i18n | F2-03, F2-04 |
| R11 | `User.name` anulable → `customerName` puede ser `null` | Tipos anulables + fallback "—" en UI | F2-03, F2-12, F2-13 |
| R12 | `importCsv` retorna `errors` por línea pero el input no lleva línea | `productCsvRowSchema` incluye `line`; filas inválidas client-side nunca se envían | F2-09 |
| R13 | Import CSV vs. límite de plan y status de existentes | Nuevos entran `DRAFT` (no consumen límite); update no toca `status` | F2-09 |
| R14 | `branch.update/setStatus/delete` "análogos" sin inputs; `monthlyOrders` sin periodo | Inputs exactos definidos; mes calendario en curso | F2-10 |
| R15 | `NOT_FOUND` ausente en varias mutations por id (`setStatus`, `delete`, `getById`) | Toda operación por id valida pertenencia → `NOT_FOUND` | F2-05, F2-07, F2-10, F2-12 |
| R16 | Búsqueda de órdenes: `folio` es `Int`, "search" sin definición | OR título/cliente + folio numérico si matchea `/^#?\d+$/` | F2-12 |
| R17 | Filtro de categoría sin fuente de opciones (`category` es String libre) | Query `listCategories` (distinct) en service y product | F2-05, F2-07 |
| R18 | Comparación `stock <= lowStockThreshold` en query | Field references de Prisma 6 (sin SQL crudo); nunca persistido | F2-07 |
| R19 | "Timeline de estado" del detalle de orden sin tabla de eventos en schema | Timeline derivado de timestamps existentes; no se inventa modelo | F2-12, F2-13 |

## Correcciones recomendadas a `spec/02-business-dashboard.md`

1. §0: acotar el selector de sucursal a las vistas con datos por sucursal (A2).
2. §1: definir `revenueDeltaPct: number | null` y la política de `PARTIALLY_REFUNDED` (A3).
3. §3: mover `PLAN_LIMIT_REACHED` de `create` a "crear como PUBLISHED / publicar" (R2);
   documentar que el import crea `DRAFT` (R13); nota de instalación de `papaparse` (A1).
4. §3/§4/§5: añadir `NOT_FOUND` a todas las mutations por id y `CONFLICT` a
   `product.delete` (R4, R15); definir inputs de `branch.update/setStatus/delete` y el
   periodo de `monthlyOrders` (R14).
5. §2 y §5: sustituir `ctx.business.plan` por `ctx.business.subscription.plan` donde
   aparezca (R1) y definir "órdenes activas" una sola vez referenciando la constante (R5).
