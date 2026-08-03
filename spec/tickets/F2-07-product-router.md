# [F2-07] Router `product` y servicio de catálogo de productos (W5, backend sin CSV)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §3; `spec/00-foundations.md` §3–§5; `spec/04-subscriptions.md` §3
- **Depende de**: F2-01 (`ACTIVE_ORDER_STATUSES`), F2-02 (`assertPlanLimit`)
- **Tamaño estimado**: L (3–6 h)

## Contexto

CRUD de productos con SKU único por negocio, límite de plan sobre productos `PUBLISHED` y
estado "stock bajo" **derivado** (`stock <= lowStockThreshold`, nunca persistido).
`importCsv` queda en F2-09.

**El inventario es por sucursal** (decisión de producto, `F0-12`): el catálogo —SKU, nombre,
precio, categoría, estado— es del negocio, y el stock vive en filas `ProductStock` (producto ×
sucursal). Esto atraviesa todo el router: qué se lista, cómo se filtra "stock bajo" y qué se
escribe al crear o editar.

**Problemas detectados en la spec, resueltos aquí:**

1. `create` lista `PLAN_LIMIT_REACHED`, pero el límite cuenta solo `PUBLISHED` y el
   default del schema es `DRAFT`. Resolución: `productCreateSchema` incluye
   `status` (default `DRAFT`); `assertPlanLimit("products")` se invoca **solo** cuando se
   crea directamente como `PUBLISHED` y en `setStatus` al pasar a `PUBLISHED`.
2. `SKU_TAKEN` no está en `ERROR_CODES` del contrato. Resolución (patrón F0 §4): declarar
   `ProductErrorCode = ErrorCode | "SKU_TAKEN"` en `product.schema.ts` y pasarlo por el
   genérico `TError`; agregar la clave a `errors.json` es/en.
3. `delete` no define `CONFLICT`, mientras servicio y sucursal sí lo tienen. Resolución:
   simetría — `CONFLICT` si existen órdenes **activas** que referencian el producto
   (`ACTIVE_ORDER_STATUSES`); las históricas no bloquean (FK `SetNull`).
4. `lowStockCount`/filtro `lowStockOnly` comparan dos columnas: usar **referencias de
   campo** de Prisma 6, ahora sobre `ProductStock` —
   `where: { stocks: { some: { stock: { lte: db.productStock.fields.lowStockThreshold } } } }`
   — sin SQL crudo. Con sucursal seleccionada, el `some` se acota a esa `branchId`.
5. **Corrige el supuesto anterior**: los productos sí se filtran por sucursal. `list` acepta
   `branchId` opcional (viene de `?branch=` vía F2-01, nunca del cliente como identificador
   de tenant: se valida con `assertBranchInBusiness`).
6. `F0-12` distingue ausencia de `ProductStock` (el producto no se maneja ahí) de una fila
   con `stock = 0` (se maneja, pero está agotado). Resolución: "stock bajo" solo se deriva
   sobre filas existentes; la API expone `isCarried` y la UI decide explícitamente qué
   sucursales maneja cada producto.

## Alcance

Crear:

- `src/server/api/routers/product.ts`
- `src/server/services/catalog/product-catalog.ts`
- `src/app/[locale]/dashboard/products/_components/product.schema.ts` (schemas + `ProductErrorCode`; el módulo UI completo llega en F2-08)

Modificar:

- `src/messages/{es,en}/errors.json` (clave `SKU_TAKEN`)

Fuera de alcance: `importCsv` y utils CSV (F2-09), UI (F2-08), registro en `appRouter`
(F2-14), cambios de schema.

## Detalle técnico

Lecturas `businessProcedure`; mutations `activeBusinessProcedure`.

### Schemas (`product.schema.ts`)

```ts
export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  category: z.string().trim().min(2).max(60),
  priceCents: z.number().int().positive(),
  status: z.nativeEnum(ProductStatus).default("DRAFT"),
  // inventario por sucursal: una entrada por sucursal donde se maneja el producto
  stocks: z.array(z.object({
    branchId: z.string().cuid(),
    stock: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).default(5),
  })).max(100).superRefine(/* branchId no puede repetirse */).default([]),
});
export const productUpdateSchema = /* id cuid + campos de catálogo parciales, sin status,
  y stocks opcional como snapshot completo de las sucursales donde se maneja */;
export const productListSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),   // nombre o SKU
  category: z.string().trim().max(60).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  lowStockOnly: z.boolean().optional(),
  branchId: z.string().cuid().optional(),   // "Todas las sucursales" si viene vacío
  cursor: z.string().cuid().optional(),
});
export type ProductErrorCode = ErrorCode | "SKU_TAKEN";
```

### Procedures

| Procedure | Proc | Comportamiento |
|-----------|------|----------------|
| `list` | business | Cursor igual que F2-05 y validado con `{ id: cursor, businessId }` (`NOT_FOUND` si es ajeno). `search` → OR `name contains insensitive` / `sku contains insensitive`. `lowStockOnly` → `stocks.some(stock <= lowStockThreshold)` y, con sucursal, el `some` incluye ese `branchId`; una fila ausente **no** es stock bajo. Result `{ items: ProductListItem[], nextCursor, totals: { count, lowStockCount } }`; `totals` con 2 counts filtrados por los mismos filtros **excepto** `lowStockOnly`/`cursor`. Cada item trae `stock: number` (sucursal seleccionada o suma), `isCarried`, `isLowStock`, `branchesCarrying` y `branchesWithLowStock`. Sin fila en la sucursal: `stock: 0`, `isCarried: false`, `isLowStock: false`. |
| `listStockBranches` | business | `branch.findMany({ where: { businessId }, select: { id, name, status } })`; todas las sucursales, incluidas pausadas, para no ocultar inventario existente |
| `getStockByBranch` | business | `{ productId }` validado junto con `businessId` → filas `{ branchId, branchName, branchStatus, isCarried, stock, lowStockThreshold, isLowStock }` de todas las sucursales del negocio. Ausencia de fila: `isCarried: false`, `stock: 0`, umbral sugerido 5 e `isLowStock: false` |
| `listCategories` | business | igual que F2-05 |
| `create` | active | Si `status === "PUBLISHED"` → `assertPlanLimit`; validar en una sola query que los `branchId` únicos pertenecen al negocio y crear producto + filas en transacción. Omitir una sucursal significa "no se maneja". `P2002` de SKU → `SKU_TAKEN` antes de `normalizeError` → `{ id }` |
| `update` | active | Transacción con `where: { id, businessId }`; cambio de SKU puede dar `SKU_TAKEN`. Si llega `stocks`, validar todos sus branches y sincronizar el snapshot de forma atómica: upsert de incluidos y `deleteMany` de filas omitidas **acotado por `productId` y `branch.businessId`** → `{ id }` |
| `setStatus` | active | `{ id, status: z.nativeEnum(ProductStatus) }`; comprobar primero `{ id, businessId }`; invocar límite solo al cambiar de un estado distinto a `PUBLISHED` (publicar de nuevo un producto ya publicado no se cuenta contra sí mismo); update con `where: { id, businessId }` → `{ id, status }` · `NOT_FOUND` · `PLAN_LIMIT_REACHED` |
| `delete` | active | `NOT_FOUND` · `CONFLICT` si `order.count({ where: { businessId, productId: id, status: { in: ACTIVE_ORDER_STATUSES } } }) > 0`; delete con `where: { id, businessId }` → `{ id }` |

Servicio `product-catalog.ts` con las funciones de dominio (reciben `db` y, donde aplique,
el `business` del ctx para `assertPlanLimit`); el router solo valida input, llama servicio
y envuelve en `ok`/`fail`. Derivar inputs con `z.infer` y filas con
`Prisma.ProductGetPayload`/`Prisma.ProductStockGetPayload` parametrizados por `select`
mínimo; sin `any`, casts amplios ni shapes Prisma duplicados.

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
- [ ] `SKU_TAKEN` viaja tipado por `TError` y tiene clave en `errors.json` es/en.
- [ ] Publicar por encima del límite del plan → `PLAN_LIMIT_REACHED`; crear DRAFT no
      consume límite. El límite cuenta **productos**, no filas de stock: agregar una sucursal
      no consume cupo de catálogo.
- [ ] Con sucursal seleccionada, `stock` e `isLowStock` son los de esa sucursal; sin
      selección, `stock` es la suma y `isLowStock` es cierto si **alguna** sucursal está baja.
- [ ] Ausencia de fila se informa como `isCarried: false` y no cuenta como stock bajo;
      fila existente con stock 0 sí puede estar baja.
- [ ] Editar catálogo + snapshot de inventario es una sola transacción; repetirlo no crea
      filas duplicadas por `[productId, branchId]`.
- [ ] "Stock bajo" jamás se persiste; siempre derivado en query o en el mapeo del item.
- [ ] Cursor, producto y sucursales ajenos nunca cruzan tenant; cada query incluye
      `businessId` obtenido de sesión.

## Comandos para Roger (si aplica)

—
