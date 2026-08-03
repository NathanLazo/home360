# [F3-04] Servicio `releasePayment` y auto-liberación `releaseDuePayments`

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §2, §5 (auto-liberación); `spec/05-admin.md` §3 (lo consume `resolve-dispute`)
- **Depende de**: `F3-03`, `XC-25`
- **Tamaño estimado**: L

## Contexto

`releasePayment` es la **única** vía de mover dinero al negocio (cliente-confirma,
auto-release, resolución de disputas F5). Dos problemas detectados y resueltos aquí:

1. **Idempotencia real ante crash**: si el proceso muere entre crear el `Transfer` y marcar
   el `Payment`, un retry ingenuo transferiría doble. Resolución: el Transfer se crea con
   `idempotencyKey` determinística derivada del `paymentId`; un retry recibe el mismo
   Transfer de Stripe y solo completa la escritura en BD.
2. **Disputas**: la spec del cron libera todo `escrowReleaseAt <= now`, lo que pagaría al
   negocio una orden en disputa. Resolución: se excluyen pagos cuya orden tenga disputa no
   resuelta (ver findings #6 para la nota a F5).

La semántica D2 ya está fijada por `XC-25`: la liberación ordinaria usa principal y jamás
transfiere la tarifa plana. La finalización de un pago parcialmente reembolsado queda
coordinada con F3-05: usa el principal retenido y la comisión proporcional aprobada; el
saldo disponible consume la fórmula neta de XC-03.

## Alcance

- Modificar: `src/server/services/payments/escrow.ts` (agregar `releasePayment`,
  `releaseDuePayments`)
- Fuera de alcance: route handler del cron (F3-10), refunds (F3-05).

## Detalle técnico

```ts
releasePayment(deps: { db; stripe }, input: { paymentId: string }):
  Promise<ServiceResult<
    { paymentId: string; stripeTransferId: string },
    "PAYMENT_NOT_RELEASABLE" | "NO_CONNECT_ACCOUNT" | "DISPUTE_OPEN"
  >>
```

Pasos:

1. Cargar `Payment` (incluido `stripeChargeId`) con
   `business { stripeAccountId, payoutsEnabled }` y
   `order { dispute { status } }` (select mínimo).
2. Guardas: `RELEASED` con `stripeTransferId` retorna éxito con ese mismo id (retry
   idempotente); cualquier otro status distinto de `IN_ESCROW` retorna
   `PAYMENT_NOT_RELEASABLE`. Sin `stripeChargeId` → `PAYMENT_NOT_RELEASABLE`. Sin
   `stripeAccountId` o `payoutsEnabled === false` →
   `NO_CONNECT_ACCOUNT`. Disputa de la orden con status ≠ `RESOLVED` → `DISPUTE_OPEN`.
3. Para un `IN_ESCROW` sin refund, calcular `netCents` con
   `providerTransferCents(payment)` de `XC-25`; nunca con `amountCents - commissionCents`.
   Validar `0 < netCents <= providerAmountCents`. Tras refund parcial, F3-05 fija
   `netCents` al principal retenido menos la comisión proporcional efectiva.
4. `stripe.transfers.create({ amount: netCents, currency: "mxn",
   destination: stripeAccountId, transfer_group: \`payment_${paymentId}\`,
   source_transaction: stripeChargeId,
   metadata: { paymentId } }, { idempotencyKey: \`transfer-release-${paymentId}\` })`.
   **El Transfer se crea antes de escribir en BD**: si la escritura falla, el retry con la
   misma key no duplica dinero.
5. En una transacción local, ejecutar el `updateMany` condicional y crear el
   `LoyaltyBonus`. Si `count === 0`, recargar el pago: si ya está `RELEASED` y conserva el
   mismo `stripeTransferId`, retornar éxito idempotente; cualquier otro estado es conflicto.
   Así un crash posterior al Transfer puede recuperarse y un consumidor (F3-11) puede
   completar su propia escritura sin quedar atascado.
6. Si el pago tiene `orderId` y la orden estaba `PAID`/`IN_PROGRESS`/`SHIPPING` no se toca
   aquí (el estado de orden lo maneja quien invoca: confirmDelivery marca COMPLETED en F3-11).
7. **Devengar el bono de lealtad** (D3), en la misma escritura que el paso 5:

   ```ts
   db.loyaltyBonus.create({
     data: {
       paymentId,
       businessId,
       pctApplied: settings.loyaltyBonusPct,          // default 50
       amountCents: Math.round(commissionCents * pct / 100),
       status: "PENDING",
     },
   })
   ```

   La idempotencia es estructural: `LoyaltyBonus.paymentId` es `@unique` (`F0-12`), así que
   un segundo release no puede crear un segundo bono — capturar la violación de unicidad
   (P2002) y continuar sin error, porque significa "ya estaba devengado".

   El bono se calcula sobre la **comisión efectivamente cobrada**, no sobre el monto. Tras
   refund parcial es la comisión proporcional efectiva de F3-05/F3-06. El bono **no** entra al saldo
   retirable de escrow: es un saldo aparte que el admin liquida (F5-16).

```ts
releaseDuePayments(deps: { db; stripe }, input?: { now?: Date }):
  Promise<ServiceResult<{ released: number; failed: number; hasMore: boolean }>>
```

- Query: `status: IN_ESCROW`, `escrowReleaseAt <= now`, y un predicado relacional explícito
  que incluye pagos de link (`orderId: null`) y órdenes sin disputa/resueltas, pero excluye
  disputa no resuelta. No usar un `NOT` ambiguo sobre relación nullable.
  `orderBy: [{ escrowReleaseAt: "asc" }, { id: "asc" }]`, con lote
  acotado (máximo 100). Iterar llamando `releasePayment`; un fallo individual no aborta el
  lote (acumula `failed`, log server-side sin datos sensibles). `hasMore` indica que el cron
  debe volver a invocarse; nunca cargar todos los vencidos en memoria ni exceder el timeout.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Transfer con `idempotencyKey` determinística; retry tras crash no duplica dinero.
- [ ] Un retry de un pago ya liberado devuelve el mismo resultado y permite completar al
      consumidor; no se trata como un error irrecuperable.
- [ ] Todo pago liberado devenga exactamente un `LoyaltyBonus` al `loyaltyBonusPct` vigente,
      y un segundo release no crea un segundo bono.
- [ ] Pagos en disputa jamás se auto-liberan.
- [ ] La firma de `releasePayment` queda estable para F5 (`resolve-dispute.ts` la consume).

## Comandos para Roger (si aplica)

—
