# [P-WEB-02] Completar contratos aditivos requeridos por mobile

## Trabajo pendiente

- `order.list`: aceptar `workerId?`, validar tenancy y filtrar solo órdenes del negocio.
- `auth.me` para WORKER: incluir `specialty`, negocio y sucursal mínima (`id`, `name`).
- `radar.getRequest`: devolver la cotización propia del negocio, si existe, para soportar
  retirar/reanudar una oferta sin inferencias del cliente.
- `quote.submit`: decidir y aplicar la transición `ServiceRequest.OPEN → QUOTED`; mantener
  `QUOTED` mientras haya al menos una oferta activa y documentar qué ocurre al retirar la
  última.
- Añadir `review.create` customer-only: orden completada y propia, una review por orden,
  rating validado y actualización consistente de agregados del negocio/trabajador.
- Mantener el sobre `TrpcResponse`, selects mínimos, ownership en servidor y traducciones
  es/en de cualquier código nuevo.

## Aceptación

- N2 puede distinguir solicitud sin oferta, cotizada y retirada.
- N5 consulta las órdenes del trabajador seleccionado sin filtrar en el cliente.
- T4 obtiene specialty/sucursal sin otra consulta privilegiada.
- La confirmación C6 puede enviar una calificación una sola vez.
- `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.


## Estado: implementado

Contratos aditivos (ningún campo existente se quitó ni se renombró). Sin migraciones:
`Review.orderId` ya era `@unique` y `Worker.ratingAvg` ya existía.

- **`order.list`** (`order-directory.ts`): `workerId?` opcional. El worker se valida contra
  `ctx.business.id`; uno ajeno o inexistente responde `NOT_FOUND` genérico (igual que una
  sucursal ajena) y el filtro `workerId` se aplica en la consulta.
- **`auth.me` WORKER** (`current-user.ts`): agrega `businessId`, `specialty` y
  `branch: { id, name } | null` (se conservan `businessName`, `fullName`, `availability`).
- **`radar.getRequest`** (`radar.ts`): agrega `status` de la solicitud y
  `ownQuote: { id, status, amountCents, scheduledFor, branchId, worker, createdAt,
  updatedAt } | null`. N2 distingue: `null` = sin oferta, `PENDING` = cotizada,
  `WITHDRAWN` = retirada. «Reanudar» significa volver a la oferta propia existente: una
  oferta `WITHDRAWN` sigue siendo terminal y no se puede re-cotizar (MA-16, sin cambios).
- **Transición `ServiceRequest`** (decisión):
  - `OPEN` = sin ofertas `PENDING`; `QUOTED` = al menos una oferta `PENDING`.
  - `quote.submit` marca `OPEN → QUOTED` (o mantiene `QUOTED`) en la misma transacción que
    crea la `Quote`, con `updateMany` condicional que además toma el lock de la fila.
  - `quote.withdraw`: al retirar la **última** oferta `PENDING`, una solicitud `QUOTED`
    **vuelve a `OPEN`** (nunca fue aceptada, así que regresa al radar de los demás
    negocios). Misma transacción, con `SELECT … FOR UPDATE` sobre la solicitud después del
    lock de la quote (orden quote → solicitud, igual que `acceptQuote`, sin deadlocks).
    `ACCEPTED`/`CANCELLED`/`EXPIRED` no se tocan (`reopenRequestIfUnquoted`).
  - Todas las puertas del radar (`listOpenRequests`, `isRequestVisibleOnRadar`,
    `getRequest`, `submitQuote`) aceptan `OPEN` y `QUOTED` (`QUOTABLE_REQUEST_STATUSES`),
    para que la transición no oculte la solicitud a quien aún no cotizó.
  - `request.cancel` (cliente) acepta `OPEN` y `QUOTED`; en una transacción expira las
    quotes `PENDING` y cancela la solicitud de forma condicional.
- **`review.create`** (router nuevo `review`, `userProcedure`): input Zod
  `{ orderId, rating: int 1–5, comment?: ≤1000 }`. Orden propia (si no, `NOT_FOUND`),
  `COMPLETED` (si no, `ORDER_NOT_REVIEWABLE`) y una sola review por orden
  (`REVIEW_ALREADY_EXISTS`, también ante carrera vía P2002 del `@unique`). En la misma
  transacción recalcula `Business.ratingAvg/ratingCount` (`recalculateBusinessRating`) y
  `Worker.ratingAvg` (`recalculateWorkerRating`, nuevo) del técnico asignado — recálculo
  completo, nunca incrementos.
- Códigos nuevos en `DOMAIN_ERROR_CODES` + `errors.json` es/en: `ORDER_NOT_REVIEWABLE`,
  `REVIEW_ALREADY_EXISTS`.
- Verificación: `pnpm typecheck`, `pnpm check` y `SKIP_ENV_VALIDATION=1 pnpm build` en verde.
