# [F3-03] Servicio `capturePayment`: registro en escrow con comisión congelada

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §2 (`payments/escrow.ts`), §5
- **Depende de**: `F3-01`, `F3-02` (`ServiceResult`), `XC-25`
- **Tamaño estimado**: M

## Contexto

Cuando llega `payment_intent.succeeded`, se registra el `Payment` en `IN_ESCROW` con la
comisión **congelada** en ese instante (`commissionPctApplied` + `commissionCents`), leyendo
el plan vigente del negocio. Problema detectado: la spec no define qué pasa si el negocio
no tiene `Subscription` al capturar (p. ej. pago de un link viejo tras cancelación).
El fallback provisional al plan `basic` de la versión anterior se elimina: Roger debe
decidir entre rechazar el cobro o agregar `PlatformSettings.defaultCommissionPct`
(findings #10). No se implementa esa rama inventando una política. El handler puede recibir
eventos duplicados: la idempotencia se ancla en el unique `stripePaymentIntentId`.

`XC-25` ya cierra la semántica estructural: `amountCents` es total cobrado,
`providerAmountCents` es principal y `serviceFeeCentsApplied` es la tarifa congelada. Solo
la distribución de un refund sobre esos componentes sigue bloqueada por Roger.

## Alcance

- Crear: `src/server/services/payments/escrow.ts` (solo `capturePayment` en este ticket)
- Fuera de alcance: `releasePayment`/`refundPayment` (F3-04/F3-05), webhook (F3-09).

## Detalle técnico

```ts
type CapturePaymentInput = {
  stripePaymentIntentId: string;
  stripeChargeId: string;
  amountCents: number;                   // total efectivamente cobrado por Stripe
  providerAmountCents: number;           // principal persistido en Order/PaymentLink
  currency: "mxn";
  businessId: string;
  method: PaymentMethod;              // CARD | TRANSFER | PAYMENT_LINK
  orderId?: string;                   // XOR con paymentLinkId (invariante F3-01)
  paymentLinkId?: string;
};

capturePayment(deps: { db; stripe }, input: CapturePaymentInput):
  Promise<ServiceResult<{ paymentId: string }, "INVALID_TARGET">>
```

Pasos (en `db.$transaction`):

1. Validar `currency === "mxn"`, `amountCents > 0` y XOR
   `orderId`/`paymentLinkId` → si falla, `svcFail("INVALID_TARGET")`.
2. Resolver el objetivo desde BD con `select` mínimo y comprobar en la misma consulta que
   existe, pertenece a `businessId`, no tiene otro pago y su monto esperado coincide
   exactamente con `amountCents`. Para link es `PaymentLink.amountCents`; para orden es el
   total de checkout ya persistido. Metadata solo localiza: nunca autoriza tenant ni monto.
3. Si ya existe `Payment` con ese `stripePaymentIntentId` → retornar `svcOk` con su id
   **sin tocar nada** (evento duplicado; no se recalcula comisión ni fechas).
   Si dos transacciones pasan la lectura, capturar `P2002` del create, recargar por
   `stripePaymentIntentId` y devolver el mismo éxito; no convertir un duplicado concurrente
   en 500.
4. Resolver el porcentaje con la función aislada `resolveCommissionPct` (abajo).
5. Leer `customerServiceFeeCents`, validar
   `amountCents === providerAmountCents + customerServiceFeeCents`, y persistirlo como
   `serviceFeeCentsApplied`. `commissionPctApplied = pct`;
   `commissionCents = Math.round(providerAmountCents * pct / 100)`
   (redondeo half-up documentado; único punto del sistema donde se calcula la comisión).
6. Leer `PlatformSettings.escrowAutoReleaseHours` (default 72 si no existe el singleton) →
   `escrowReleaseAt = now + hours`.
7. `db.payment.create({ status: IN_ESCROW, amountCents, providerAmountCents,
   serviceFeeCentsApplied, commissionPctApplied, commissionCents, businessId, orderId?,
   paymentLinkId?, stripePaymentIntentId,
   stripeChargeId, escrowReleaseAt, method })`. `stripeChargeId` viene de
   `PaymentIntent.latest_charge` validado por el webhook; permite ligar el Transfer al
   cargo real en F3-04.
8. Si `orderId`: actualizar `Order.status = PAID` solo si estaba `PENDING`
   (`updateMany` condicional, idempotente).

### `resolveCommissionPct` — función aislada (D1)

Vive en el mismo módulo, exportada, con una sola responsabilidad: decidir el porcentaje.
Se aísla porque la fase F7 (cuentas corporativas B2B) añadirá una rama sin tocar el resto
del servicio.

```ts
// escalera vigente: basic 10 % · standard 8 % · enterprise 5 %  (spec/08 D1)
resolveCommissionPct(db, { businessId, corporateAccountId }): Promise<number>
```

Orden de resolución, y **este orden es la regla**:

1. Si la orden viene de una cuenta corporativa (`Order.corporateAccountId` presente, columna
   declarada en `F0-12`), el porcentaje sale de la cuenta corporativa, no del plan del
   proveedor. **En F3 esta rama no se implementa**: si el id aparece antes de F7, fallar con
   código estable `CORPORATE_PRICING_NOT_AVAILABLE`; nunca cobrar silenciosamente el plan
   del proveedor.
2. Plan vigente del negocio: `db.business.findUnique({ where: { id: businessId },
   select: { subscription: { select: { plan: { select: { commissionPct: true } } } } } })`.
3. Sin suscripción → **bloqueado por decisión de Roger** (findings #10). No usar
   silenciosamente el plan `basic`, cero, ni un literal. El ticket solo queda implementable
   cuando la política y su error estable, si aplica, estén escritos aquí.

### Quién paga qué (D2)

Queda escrito aquí porque es donde se calcula el dinero, y las specs anteriores eran
ambiguas:

- El **cliente** paga `amountCents` = `providerAmountCents` +
  `PlatformSettings.customerServiceFeeCents`
  (tarifa **plana**, hoy $25). No hay recargo porcentual al cliente: el ejemplo del deck
  ("fee 10 % encima del precio") es una simplificación de pitch, y manda el desglose que la
  app le muestra al usuario.
- La **comisión** se calcula sobre `providerAmountCents`; el transfer de `releasePayment`
  (F3-04) usa el helper `providerTransferCents` de `XC-25`. La tarifa nunca llega al
  proveedor ni entra a la base porcentual.

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
- [ ] Comisión y % quedan congelados al capturar; cambios de plan posteriores no los alteran.
- [ ] Idempotente por `stripePaymentIntentId`: duplicados no dobletean.
- [ ] Tenant, objetivo, moneda y monto se validan contra BD; metadata no puede redirigir un
      pago ni alterar su importe.
- [ ] `escrowReleaseAt` se fija desde `PlatformSettings.escrowAutoReleaseHours`.
- [ ] La política sin suscripción está decidida explícitamente; no existe fallback provisional.
- [ ] La base de comisión, la tarifa plana congelada, el total cobrado y el neto del
      proveedor tienen nombres/fórmulas no ambiguos y coinciden con F3-01/F3-04/F3-06.

## Comandos para Roger (si aplica)

—
