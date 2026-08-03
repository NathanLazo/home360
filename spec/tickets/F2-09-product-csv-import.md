# [F2-09] Import CSV de productos (papaparse + `product.importCsv`)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §3 (import CSV); `spec/00-foundations.md` §2, §4
- **Depende de**: F2-07, F2-08
- **Tamaño estimado**: L (3–6 h)

## Contexto

Slice vertical del import: parseo client-side con papaparse, validación Zod por fila,
preview con errores, mutation `importCsv` con upsert por `(businessId, sku)` en
transacción.

**Problemas detectados en la spec, resueltos aquí:**

1. **`papaparse` no está en las dependencias de F0 §2** (solo stripe, bcryptjs,
   next-intl, recharts). Resolución: este ticket lo agrega
   (`pnpm add papaparse` + `pnpm add -D @types/papaparse`). Recomendada corrección de F0
   (ver `F2-findings.md`).
2. El input `{ rows: productCsvRowSchema[] }` no transporta el número de línea, pero el
   result exige `errors: Array<{ line, code }>`. Resolución: `productCsvRowSchema`
   incluye `line: z.number().int().positive()` (línea original del CSV, la fila 1 es el
   header) — se respeta la forma del input de la spec.
3. No se define qué pasa con filas inválidas client-side vs errores server-side.
   Resolución: las filas que fallan Zod en el cliente **nunca se envían**; se muestran en
   el preview con línea y código. El server re-valida por el schema del input (tRPC) y
   además reporta errores de negocio por fila: `DUPLICATE_SKU_IN_FILE` (SKU repetido en el
   payload; la primera ocurrencia gana). Filas válidas se procesan aunque otras fallen.
4. Límite de plan: el import crea productos nuevos como `DRAFT` y **no cambia el status**
   de los existentes, por lo que no consume límite de plan (coherente con F2-07).
5. Códigos nuevos `DUPLICATE_SKU_IN_FILE` y `CSV_*` del cliente son de dominio: se
   declaran en `product.schema.ts` (patrón F0 §4) con claves en `errors.json`.
6. Un `upsert` no informa si creó o actualizó. Resolución: el servicio carga primero los
   SKU existentes del negocio con `select: { sku: true }`, congela esa clasificación y
   luego ejecuta la escritura atómica; los contadores no se infieren del resultado de
   Prisma ni de una segunda lectura.

## Alcance

Crear:

- `src/app/[locale]/dashboard/products/_components/product-import-dialog.tsx`
- `src/app/[locale]/dashboard/products/_components/product-csv.utils.ts`

Modificar:

- `src/app/[locale]/dashboard/products/_components/product.schema.ts` (`productCsvRowSchema`, códigos CSV)
- `src/server/api/routers/product.ts` (+ `importCsv`)
- `src/server/services/catalog/product-catalog.ts` (+ `importProductRows`)
- `src/app/[locale]/dashboard/products/_components/products-view.tsx` (botón "Importar CSV" en header)
- `src/messages/{es,en}/dashboard.json` y `errors.json`
- `package.json` vía `pnpm add papaparse` / `pnpm add -D @types/papaparse`

Fuera de alcance: export CSV, plantilla descargable (opcional: link estático a un CSV de
ejemplo en `public/` — permitido si es barato), cambios de schema Prisma.
En `dashboard.json` modificar solo `dashboard.products.import.*`; en `errors.json`, solo
los códigos CSV declarados aquí. F2-08 serializa ambos archivos compartidos.

## Detalle técnico

### Formato CSV (documentar en el dialog)

Header obligatorio: `name,sku,category,price,stock,low_stock_threshold`
(`low_stock_threshold` opcional → default 5). `price` en **pesos** con decimales
(`"249.90"`); la conversión a centavos (`Math.round(parse * 100)`) ocurre en
`product-csv.utils.ts` — a partir de ahí todo es centavos.

### `product.schema.ts`

```ts
export const productCsvRowSchema = z.object({
  line: z.number().int().positive(),
  name: /* igual que create */, sku: /* igual */, category: /* igual */,
  priceCents: z.number().int().positive(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});
export const productImportSchema = z.object({
  rows: z.array(productCsvRowSchema).min(1).max(500),
  branchId: z.string().cuid(),   // sucursal destino del inventario importado
});
export type CsvRowErrorCode =
  | "CSV_MISSING_COLUMN" | "CSV_INVALID_NAME" | "CSV_INVALID_SKU"
  | "CSV_INVALID_PRICE" | "CSV_INVALID_STOCK" | "DUPLICATE_SKU_IN_FILE";
```

### `product-csv.utils.ts` (client-safe, sin imports de server)

```ts
parseProductsCsv(file: File): Promise<{ valid: ProductCsvRow[]; errors: CsvRowError[] }>
```

papaparse con `header: true, skipEmptyLines: true`; rechaza archivos mayores de 2 MiB y
detiene/rechaza al detectar más de 500 filas de datos antes de construir un payload
ilimitado. Mapea columnas → candidato; conserva el número físico original de línea
(incluyendo header y líneas vacías); valida
con `productCsvRowSchema.safeParse` fila por fila; los issues Zod se traducen a
`CsvRowErrorCode` por campo. Header sin columnas obligatorias → error global
`CSV_MISSING_COLUMN`. Separar una función pura `mapParsedRows(rows: unknown[])` sin
crear tests automatizados.

### `importCsv` (activeBusinessProcedure)

`importProductRows(db, businessId, branchId, rows)`:

0. Validar que `branchId` pertenece al negocio (`assertBranchInBusiness`, F2-01) →
   `NOT_FOUND`. El inventario es por sucursal (`F0-12`), así que **un CSV siempre se importa
   contra una sucursal concreta**: el archivo describe qué hay en una bodega, no en la
   empresa entera.
1. Dedup por `sku` (primera gana; repetidas → error `DUPLICATE_SKU_IN_FILE` con su `line`).
2. Consultar una vez los SKU existentes con
   `product.findMany({ where: { businessId, sku: { in: uniqueSkus } }, select: { sku: true } })`.
3. `db.$transaction` sobre las filas restantes:
   - `upsert` del producto por `@@unique([businessId, sku])` — `create` con
     `status: "DRAFT"`; `update` de name/category/priceCents **sin tocar `status`**.
   - `upsert` de `ProductStock` por `@@unique([productId, branchId])` con el `stock` y
     `lowStockThreshold` de la fila. Importar el mismo archivo en otra sucursal actualiza el
     inventario de esa sucursal y deja intacto el de las demás, que es exactamente el
     comportamiento esperado al reponer.
4. Result: `{ created, updated, errors }`, donde `created/updated` salen del conjunto de
   SKU previo. Toda query incluye `businessId` de sesión; `branchId` solo selecciona el
   inventario destino después de validar pertenencia.

### `product-import-dialog.tsx`

Dialog en 3 estados: dropzone (input file + drag&drop) → preview (tabla con primeras 10
filas válidas + lista de errores "Línea N: <mensaje traducido>" + resumen "X válidas ·
Y con errores") → confirmación/resultado ("N creados, M actualizados" + errores server si
hubo). Botón confirmar deshabilitado si 0 filas válidas; archivo > 500 filas válidas →
error y no envía. Mutation con toast + `invalidate` de `product.list`.

**Selector de sucursal destino**, arriba del dropzone: se precarga con la sucursal activa
del selector global (`?branch=`) y, si la vista está en "Todas las sucursales", **obliga a
elegir una de `product.listStockBranches` antes de habilitar el dropzone. El texto del diálogo lo dice sin rodeos: el
inventario del archivo se aplicará a esa sucursal. Importar 500 filas a la bodega equivocada
es un error caro de deshacer, así que la elección es explícita, nunca implícita.

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
- [ ] CSV de 20 filas (2 inválidas) → preview reporta las 2 con línea y código; confirmar
      importa 18 y muestra "creados/actualizados".
- [ ] Upsert idempotente: re-importar el mismo archivo en la misma sucursal → 0 created,
      N updated, y el stock queda igual (no se suma).
- [ ] Importar el mismo archivo en otra sucursal actualiza solo el inventario de esa
      sucursal; el de las demás no cambia.
- [ ] En "Todas las sucursales" el diálogo exige elegir destino antes de aceptar el archivo.
- [ ] El status de productos existentes no cambia; nuevos entran como DRAFT.
- [ ] `papaparse` y `@types/papaparse` en `package.json`; parse solo en cliente.
- [ ] Archivo > 2 MiB o > 500 filas se rechaza antes de invocar tRPC; los números de línea
      reportados corresponden al archivo original.
- [ ] `created/updated` es exacto en primera importación y reimportación; no se deduce de
      un `upsert` que no distingue ambas operaciones.

## Comandos para Roger (si aplica)

—
