# [F7-05] Router `corporate`: resumen, órdenes, ubicaciones y membresía

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §5
- **Depende de**: `F7-02`, `F7-03`, `XC-26` y `XC-03` con la política de
  reembolsos/saldos aprobada
- **Tamaño estimado**: L (3–6 h)

## Contexto

Backend del dashboard que ve el cliente corporativo. Toda la superficie es multi-tenant: cada
query filtra por `ctx.corporateAccount.id` **dentro** de la consulta Prisma, nunca después de
traer filas.

## Alcance

Crear:

- `src/server/services/corporate/corporate-locations.ts`
- `src/server/services/corporate/corporate-spending.ts`
- `src/server/services/corporate/corporate-membership.ts`
- `src/server/services/corporate/corporate-tier-requests.ts`
- `src/server/api/schemas/corporate.ts` (schemas Zod compartidos por router/UI)
- `src/server/api/routers/corporate.ts`

Modificar: `src/server/api/root.ts`.

Fuera de alcance: UI (F7-06); administración (F7-03).

## Detalle técnico

| Procedure | Proc | Input | Result / Errores |
|-----------|------|-------|------------------|
| `getOverview` | corporate | `{ month?: "YYYY-MM" }` | `{ spentCents, ordersActive, ordersMonth, locationsActive, savedByRateCents }` |
| `listOrders` | corporate | `{ locationId?: cuid, status?: OrderStatus, cursor?: cuid, limit?: 1..100 }` | `{ items, nextCursor }` con negocio, ubicación, monto y estado |
| `listLocations` | corporate | `{ includeInactive? }` | ubicaciones con conteo de órdenes |
| `createLocation` | active | `{ name, addressLine, city, contactName?, contactPhone? }` | `{ id }` · `PLAN_LIMIT_REACHED` si excede `maxLocations` |
| `updateLocation` | active | `{ locationId, …campos }` | `{ id }` · `NOT_FOUND` |
| `deactivateLocation` | active | `{ locationId }` | `{ id }` · `CONFLICT` si tiene órdenes activas |
| `getMembership` | corporate | — | tier, cuota, comisión, `renewsAt`, estado, uso vs. límite y solicitud pendiente |
| `listInvoices` | corporate | `{ cursor?: cuid, limit?: 1..100 }` | `{ items, nextCursor }` de `CorporateInvoice` con `pdfUrl` |
| `requestTierChange` | active | `{ tier, notes? }` | `{ id }` — abre solicitud, **no** cambia el tier |

Toda fila de resultado se define con `Prisma.*GetPayload<{ select: ... }>` o se infiere del
`select`/aggregate real. Cada procedure es una capa delgada y retorna exactamente
`TrpcResponse`: éxito `{ result, error: null, status: 200, message }`; fallo
`{ result: null, error, status, message }`. `message` sirve para logs/diagnóstico, la UI
traduce `error`.

Detalles que definen el comportamiento:

- **`savedByRateCents`** es el argumento de venta del tier y se calcula, no se inventa: por
  cada pago corporativo elegible del periodo se suma
  `max(0, providerPlanCommissionCents - commissionCents)` usando los snapshots de `XC-26`.
  No reconstruir el ahorro con el plan actual del proveedor: produciría historia falsa.
  Los estados/refunds elegibles son exactamente los fijados en `XC-03`; no crear otra
  política local. Si la cuenta no tiene ventaja, el número es 0 y la UI lo omite.
- **Periodo**: `month` se interpreta en la zona de negocio adoptada por la app
  (`America/Chihuahua`) y se transforma una vez a límites UTC `[start, end)` antes de
  consultar. Mes inválido → `VALIDATION_ERROR`; no usar hora local del servidor.
- **Gasto**: `spentCents` suma montos cobrados de órdenes corporativas en el periodo, no cuota
  de membresía ni PaymentLinks. Documentar el tratamiento de `REFUNDED` y
  `PARTIALLY_REFUNDED` conforme a la decisión de `PENDIENTES.md` materializada en `XC-03`.
  Reutilizar la función central resuelta en F3/XC-03; si Roger aún no aprobó esa política,
  este ticket queda bloqueado y no inventa una quinta fórmula.
- **`requestTierChange` no cambia nada por sí mismo**: los tiers se negocian y algunos son
  `CUSTOM`. Deja registro para el admin (F7-03 lo resuelve con `updateTerms`), y responde
  éxito con estado "solicitado". Solo puede existir una solicitud `PENDING` por cuenta
  (idempotencia por `pendingKey @unique`); repetir la misma solicitud devuelve la existente
  y otra distinta retorna `CONFLICT`.
- **`deactivateLocation`** no borra: desactiva. Las órdenes históricas conservan su ubicación.
- **Pertenencia de ubicación**: `listOrders(locationId)` valida y filtra en una sola consulta
  por `{ id: locationId, corporateAccountId: ctx.corporateAccount.id }`; id ajeno e
  inexistente producen el mismo `NOT_FOUND`. `updateLocation`/`deactivateLocation` usan
  `updateMany`/queries con ambos ids, nunca `findUnique(id)` seguido de chequeo en memoria.
- **Carrera del límite**: contar ubicaciones activas y crear/reactivar una ubicación ocurre
  en una transacción serializable (con retry acotado de conflictos Prisma). `maxLocations:
  null` significa ilimitado. Actualizar una ubicación inactiva no la reactiva de forma
  implícita.
- **Órdenes activas** para impedir desactivación se enumeran con los estados operativos
  definidos por `OrderStatus` en el código implementado; no usar una lista de strings sin
  tipo. Consulta y update viven en la misma transacción.
- El límite de ubicaciones usa el mismo contrato de error que los límites de plan de F4
  (`PLAN_LIMIT_REACHED` con detalle de qué excede), para que la UI reutilice el mismo manejo.
- **Facturación consolidada**: `listInvoices` consulta `CorporateInvoice` por
  `corporateAccountId` y pagina en orden `issuedAt desc, id desc`. Una sola membresía/customer
  cubre todas las ubicaciones; no crear suscripciones ni facturas por ubicación. Sin
  `pdfUrl`, retornar `null` y la UI deshabilita descarga.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Tenant desde sesión, filtrado dentro de la query Prisma; nunca un `accountId` de input.
- Mutaciones bajo `activeCorporateProcedure`; lecturas bajo `corporateProcedure`.
- TypeScript estricto: sin `any`; `select` explícito y mínimo en Prisma.
- Identificadores en inglés; dinero en centavos; ningún monto calculado en cliente.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] Ninguna procedure acepta un identificador de cuenta desde el cliente.
- [ ] `savedByRateCents` deriva solo de los dos montos congelados por `XC-26`.
- [ ] El ahorro no cambia si después cambia el plan del proveedor o los términos corporativos.
- [ ] `requestTierChange` no modifica tier, comisión ni cuota.
- [ ] Dos requests concurrentes no dejan dos solicitudes `PENDING`.
- [ ] Ubicación con órdenes activas no se puede desactivar.
- [ ] Crear ubicaciones concurrentemente no supera `maxLocations`.
- [ ] `locationId` ajeno e inexistente son indistinguibles y nunca filtran después de cargar.
- [ ] Facturas pertenecen a una sola cuenta corporativa y cada `stripeInvoiceId` aparece una
      sola vez.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
