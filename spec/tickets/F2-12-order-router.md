# [F2-12] Router `order` de solo lectura (lista + detalle)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §5; `spec/00-foundations.md` §3–§5;
  `spec/08-business-model-alignment.md` D5; `spec/tickets/F0-12-marketplace-schema-extensions.md`
- **Depende de**: F2-01 (`assertBranchInBusiness`)
- **Tamaño estimado**: M

## Contexto

Las órdenes nacen en la app móvil / seed; en F2 solo se listan y consultan (las
transiciones de pago llegan en F3). Dos queries `businessProcedure`.

**Problemas detectados en la spec, resueltos aquí:**

1. `getById` no lista errores. Resolución: `NOT_FOUND` si la orden no pertenece al
   negocio (mismo mensaje que si no existe).
2. `search` no define sobre qué busca. `folio` es `Int`. Resolución: OR sobre
   `title contains insensitive`, `customer.name contains insensitive` y, si el término
   matchea `/^#?\d+$/`, además `folio: { equals: parseInt }`.
3. El result de `list` no está tipado en la spec ("items con folio, título…").
   Resolución: shape exacto abajo; `customerName`/`branchName` anulables (schema F0).
4. D5 de `08-business-model-alignment.md` amplía la evidencia raíz de una orden
   (`recordingComplete`, fotos antes/después, notas y materiales), pero el detalle F2 solo
   enumeraba "grabación". Resolución: el detalle de solo lectura incluye toda esa evidencia
   ya presente desde F0-12; no añade mutations ni modelos.

## Alcance

Crear:

- `src/server/api/routers/order.ts`
- `src/server/services/orders/order-directory.ts`

Fuera de alcance: mutations de órdenes (no existen en F2), UI (F2-13), registro en
`appRouter` (F2-14), cambios de schema.

## Detalle técnico

### `list`

Input:

```ts
const orderListSchema = z.object({
  branchId: z.string().cuid().optional(),   // validar con assertBranchInBusiness → NOT_FOUND
  status: z.nativeEnum(OrderStatus).optional(),
  type: z.nativeEnum(OrderType).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().cuid().optional(),
});
```

Cursor idéntico al patrón F2-05 (`take: 21`, `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`).
Antes de usarlo, validar `findFirst({ where: { id: cursor, businessId } })`; cursor
ajeno/inexistente → `NOT_FOUND`.
Result:

```ts
{ items: Array<{
    id: string; folio: number; title: string; type: OrderType;
    customerName: string | null; branchName: string | null;
    amountCents: number; status: OrderStatus; createdAt: Date;
  }>; nextCursor: string | null }
```

`select` mínimo con `customer: { select: { name } }`, `branch: { select: { name } }`;
mapeo a shape plano en el servicio.

### `getById`

Input `{ id: z.string().cuid() }`. `findFirst({ where: { id, businessId } })` →
`NOT_FOUND` si `null`. Result `OrderDetail`:

```ts
{
  id: string; folio: number; type: OrderType; title: string; status: OrderStatus;
  amountCents: number; quantity: number; recordingUrl: string | null;
  recordingComplete: boolean; recordingDurationSec: number | null;
  beforeUrls: string[]; afterUrls: string[]; workNotes: string | null;
  createdAt: Date; updatedAt: Date;
  customer: { name: string | null; email: string | null };
  branch: { id: string; name: string } | null;
  service: { id: string; name: string; category: string } | null;
  product: { id: string; name: string; sku: string } | null;
  payment: {
    status: PaymentStatus; method: PaymentMethod; amountCents: number;
    commissionCents: number; escrowReleaseAt: Date | null; releasedAt: Date | null;
    createdAt: Date;
  } | null;
  review: { rating: number; comment: string | null } | null;
  materials: Array<{
    id: string; name: string; quantity: number; unitPriceCents: number;
    product: { id: string; name: string; sku: string } | null;
  }>;
}
```

El `findFirst` usa `where: { id, businessId }` y un `select` explícito que contiene solo
los campos anteriores. El tipo de fila se deriva con
`Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>` y el shape público por
mapeo tipado; no usar `include`, `any`, shorthand pseudocódigo como tipo real ni casts.

El "timeline de estado" del Sheet (F2-13) se **deriva** de `createdAt`, `payment.createdAt`,
`payment.releasedAt` y `status` — no hay tabla de eventos en el schema F0; no inventar una.

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
- [ ] Con seed: ~15 órdenes listables; filtros por estado/tipo/sucursal funcionan
      combinados; búsqueda por folio y por título.
- [ ] `getById` expone pago/servicio/producto/grabación; jamás órdenes de otro negocio.
- [ ] `getById` expone además `recordingComplete`, duración, evidencia antes/después,
      notas y materiales con precios en centavos, todos con `select` mínimo.
- [ ] Sin mutations en el router.
- [ ] Cursor de otro negocio devuelve `NOT_FOUND` y no altera la paginación.

## Comandos para Roger (si aplica)

—
