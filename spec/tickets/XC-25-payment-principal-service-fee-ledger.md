# [XC-25] Separar principal, tarifa de servicio y comisión en cada pago

## Metadatos

- **Fase**: XC — contrato monetario transversal F0/F3
- **Spec origen**: `spec/08-business-model-alignment.md` D1–D3 ·
  `spec/07-product-context.md` §2.5 · `spec/03-payments.md` §1–§2
- **Depende de**: `F0-12`
- **Tamaño estimado**: L (3–6 h)

## Contexto

D2 dice que el cliente paga precio del proveedor + tarifa plana, mientras la comisión se
descuenta del payout del proveedor. F3-03 hoy calcula la comisión sobre `Payment.amountCents`
y F3-04 transfiere `amountCents − commissionCents`: así cobra comisión sobre la tarifa y
además entrega esa tarifa al proveedor. Los KPIs tampoco pueden separar GMV, ingreso de
plataforma y principal. Se necesita un ledger congelado por pago. Roger cerró la política de
refund: el total devuelve toda la tarifa y el parcial devuelve solo la porción indicada
explícitamente por el caller autorizado. El ledger de este ticket permite auditar ambas ramas.

## Alcance

- `prisma/schema.prisma`: congelar componentes del cobro antes del seed transaccional.
- Crear `src/server/services/payments/payment-ledger.ts` con helpers puros y tipos derivados
  de Prisma; F3-03/F3-04/F3-05 consumen este contrato, pero conservan ownership de captura,
  release, refund y metadata Stripe.
- Fuera de alcance: agregados y UI (`XC-27`), implementar servicios F3, cambiar precios de
  planes o ejecutar migraciones/Stripe.

## Detalle técnico

Contrato canónico:

```text
amountCents = providerAmountCents + serviceFeeCentsApplied
commissionCents = round(providerAmountCents * commissionPctApplied / 100)
providerTransferCents =
  providerAmountCents - providerRefundedCents - commissionCents
platformGrossRevenueCents =
  commissionCents + serviceFeeCentsApplied - serviceFeeRefundedCents
refundedCents = providerRefundedCents + serviceFeeRefundedCents
```

`Payment` gana snapshots `providerAmountCents Int`, `serviceFeeCentsApplied Int`,
`providerRefundedCents Int @default(0)` y `serviceFeeRefundedCents Int @default(0)`.
`amountCents`, `commissionPctApplied`, `commissionCents` y `refundedCents` se conservan para
el total cobrado, porcentaje congelado, comisión y refund total.

Reglas:

1. Este ticket define el input canónico que `capturePayment` debe consumir: principal
   explícito; F3-03 lee y congela
   `PlatformSettings.customerServiceFeeCents` (ese es el nombre real, no
   `serviceFeeCents`) y valida la igualdad del total antes de persistir.
2. F3-08 debe declarar si el monto de un payment link es principal y añadir la tarifa, o si
   es cobro
   total sin tarifa. Esa semántica se escribe en el input/metadata; no se infiere del total.
3. F3-04 `releasePayment` transfiere únicamente `providerTransferCents`; la tarifa plana jamás
   llega a Connect.
4. F3-05 `refundPayment` persiste la asignación explícita entre principal y tarifa. La suma debe
   coincidir con el Refund de Stripe. El caller no puede pasar un monto opaco. En refund total,
   la asignación es todo el principal más toda `serviceFeeCentsApplied`; en refund parcial,
   ambos componentes son explícitos, aunque uno sea cero, y la tarifa no se prorratea.
5. Exponer en `payment-ledger.ts` helpers puros `providerTransferCents(payment)` y
   `platformGrossRevenueCents(payment)` para que `XC-27` no replique fórmulas.
6. F0-14 consume estos campos y fija las cuatro cantidades para que las igualdades sean
   auditables. Ningún otro ticket vuelve a declarar el schema o las fórmulas.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure.
- TypeScript estricto: sin `any`; tipos Prisma/Zod/tRPC.
- Todo dinero en centavos `Int`; cálculos autoritativos solo en servidor.
- Copy visible solo vía next-intl (es/en).
- **Sin pruebas automatizadas**: verificación con `pnpm typecheck`, `pnpm check`, `pnpm build`
  y casos manuales aritméticos.
- BD: solo `pnpm prisma generate`; Roger ejecuta migraciones/seed.
- No ejecutar Stripe.

## Criterios de aceptación

- [ ] Para principal $1,000 + tarifa $25 al 10 %, se cobran $1,025, se retienen $125
      ($100 comisión + $25 tarifa) y se transfieren $900 antes de refunds.
- [ ] Cambiar settings después del cobro no altera snapshots históricos.
- [ ] Refund total/parcial conserva la igualdad entre sus cuatro componentes.
- [ ] Refund total devuelve toda `serviceFeeCentsApplied`; refund parcial devuelve solo
      `serviceFeeRefundCents` autorizado explícitamente.
- [ ] Los helpers devuelven bases explícitas distintas para saldo proveedor e ingreso de
      plataforma; este ticket no implementa KPIs.
- [ ] No queda ninguna referencia a `PlatformSettings.serviceFeeCents`.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

La migración resultante se entrega como archivo para revisión; este ticket no la ejecuta.
