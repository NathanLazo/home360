# [F2-08] W5 — UI de productos `/dashboard/products` (sin import CSV)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §3; `spec/00-foundations.md` §7
- **Depende de**: F2-01, F2-06 (patrón de referencia), F2-07, F2-14 (routers registrados)
- **Tamaño estimado**: L

## Contexto

Vista W5 replicando el patrón de F2-06 (services) con las particularidades de productos:
contador de header "N productos · M con stock bajo", chip-filtro "Stock bajo", celda de
stock con indicador ámbar y badge Borrador/Publicado. El diálogo de import CSV llega en
F2-09 (aquí solo se deja el botón del header que abre un placeholder deshabilitado o se
omite hasta F2-09 — preferir omitir para no shippear UI muerta; F2-09 lo agrega).

## Alcance

Crear bajo `src/app/[locale]/dashboard/products/`:

- `page.tsx` · `loading.tsx` · `error.tsx`
- `_components/products-view.tsx`
- `_components/products-table.tsx`
- `_components/product-row-actions.tsx`
- `_components/product-form-sheet.tsx`
- `_components/product-form-fields.tsx`
- `_components/product-status-badge.tsx`
- `_components/product-filters.tsx`
- `_components/product-stock-cell.tsx`
- `_components/product-stock-fields.tsx`
- `_components/product.types.ts`
- `_components/use-product-mutations.ts`
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (`dashboard.products.*`)

Modificar:

- `_components/product.schema.ts` solo si faltara algo de F2-07 (no duplicar schemas).

Fuera de alcance: `product-import-dialog.tsx`, `product-csv.utils.ts` (F2-09).
No modificar namespaces i18n ajenos a `dashboard.products.*`; la dependencia F2-06
serializa la escritura del JSON compartido.

## Detalle técnico

Mismo patrón de F2-06 (prefetch en `page.tsx` de `product.list` +
`product.listCategories` + `product.listStockBranches`,
view client con estado de sheet/filtros, hook de mutations con toast + invalidate).
Las queries desempaquetan `TrpcResponse`: `response.result` es la única fuente de datos,
`response.error` usa `errors.<code>` y `query.error` queda para fallos de transporte.
Particularidades:

- **Header** (`PageHeader`): subtítulo con `totals` — clave i18n con interpolación y
  plurales ICU: `dashboard.products.summary` = `"{count, plural, one {# producto} other {# productos}} · {lowStock} con stock bajo"` (es) y equivalente en en.
- **`product-filters.tsx`**: búsqueda (nombre o SKU) + Select categoría + Select estado
  (Todos/Borrador/Publicado) + **chip toggle** "Stock bajo" (`Badge`/`Toggle` shadcn) que
  mapea a `lowStockOnly`.
- **`products-table.tsx`**: columnas producto, SKU (Geist Mono), categoría, precio (MXN,
  Geist Mono), stock (`product-stock-cell.tsx`), estado (`product-status-badge.tsx`:
  Borrador gris / Publicado verde), acciones.
- **`product-stock-cell.tsx`**: número + punto ámbar y tooltip/etiqueta "Stock bajo"
  cuando `isLowStock` (derivado en server, F2-07 — la UI **no** recalcula la regla).
  El inventario es **por sucursal** (`F0-12`), así que la celda tiene dos lecturas y debe
  distinguirlas o el dato engaña:
  - Con sucursal seleccionada (`?branch=`), muestra el stock de esa sucursal.
  - En "Todas las sucursales", muestra el **total** y, si `branchesWithLowStock > 0`, el
    punto ámbar con tooltip "Bajo en N de M sucursales donde se maneja". Si
    `isCarried === false`, muestra "No disponible en esta sucursal" sin marcarlo como
    stock bajo.
- **`product-row-actions.tsx`**: editar / publicar-despublicar (`setStatus`) / eliminar
  (ConfirmDialog). `PLAN_LIMIT_REACHED` al publicar → toast con `errors.PLAN_LIMIT_REACHED`
  (verificación de spec §7: producto 51 en plan básico). `SKU_TAKEN` en form → error bajo
  el input SKU + toast.
- **`product-form-sheet.tsx` / `product-form-fields.tsx`**: campos name, sku, category
  (sugerencias de `listCategories`), precio en pesos (conversión a centavos solo en
  submit), switch "Publicar" (status). Validación `safeParse` con
  `productCreateSchema`/`productUpdateSchema`.
- **`product-stock-fields.tsx`** (nuevo, dentro del sheet): sección "Inventario por
  sucursal" con una fila por sucursal del negocio (`listStockBranches` al crear,
  `getStockByBranch` al editar), toggle "Se maneja aquí" y, solo al activarlo, inputs de
  stock y umbral. Ausencia de fila significa "no se maneja"; una fila activada con stock
  0 significa "agotado" y puede ser stock bajo. El submit envía un snapshot con únicamente
  las filas activadas; `product.update` sincroniza catálogo e inventario en una transacción.
  Con una sola sucursal, la sección se colapsa a un par de inputs sin encabezados: no tiene
  sentido cobrarle complejidad de multi-sucursal a quien no la tiene.
- **Estados**: skeleton, `EmptyState` con CTA, `error.tsx`. Lista vacía por filtros ≠
  catálogo vacío (mensajes distintos).
- **i18n**: `dashboard.products.*` completo es/en.

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
- [ ] Header muestra "N productos · M con stock bajo" desde `totals` (plurales correctos es/en).
- [ ] Chip "Stock bajo" filtra; el punto ámbar aparece exactamente cuando `stock <= lowStockThreshold` (dato del server).
- [ ] Cambiar de sucursal en el selector cambia el stock mostrado; en "Todas" se ve el total
      y se advierte si alguna sucursal está baja.
- [ ] El formulario permite fijar stock y umbral por sucursal, y con una sola sucursal no
      muestra estructura de multi-sucursal.
- [ ] "No se maneja" (sin fila) y "agotado" (fila con stock 0) son estados distintos y
      sobreviven a editar/guardar sin actualizaciones parciales.
- [ ] Publicar sobre el límite del plan → toast `PLAN_LIMIT_REACHED`; SKU duplicado → error en campo.
- [ ] SKU y montos en Geist Mono; montos `Intl` MXN.
- [ ] Sheets/Dialogs/Dropdowns operables con teclado.
- [ ] Ningún componente trata `TrpcResponse` como resultado directo.

## Comandos para Roger (si aplica)

—
