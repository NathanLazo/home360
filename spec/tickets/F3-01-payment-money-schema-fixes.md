# [F3-01] Ajustar el schema de dinero para links, saldos y capacidades de Connect

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §5; `spec/00-foundations.md` §3 (modelos `Payment`, `PaymentLink`, `Business`)
- **Depende de**: F0 completada y `XC-25` aplicado (ledger principal/tarifa ya migrado)
- **Tamaño estimado**: S

## Contexto

Tres problemas detectados en la spec que bloquean F3 tal como está el schema de F0:

1. `Payment.orderId` es **obligatorio**, pero F3 §5 exige crear un `Payment` cuando se paga un
   link de cobro, que **no tiene orden**. Resolución: `orderId` pasa a opcional y se agrega
   `paymentLinkId` opcional; exactamente uno de los dos debe estar presente (invariante de
   servicio, no de BD).
2. `Payment` no tiene `businessId`, así que los saldos derivados (`balances.ts`, "una sola
   pasada de agregaciones") exigirían joins por dos padres distintos (Order o PaymentLink).
   Resolución: denormalizar `businessId` en `Payment` (se fija al capturar y nunca cambia).
3. El webhook `account.updated` debe "refrescar la capacidad de payouts del negocio", pero
   `Business` no tiene dónde persistirla. Resolución: `chargesEnabled` y `payoutsEnabled`
   booleanos en `Business`.

Ver `spec/tickets/F3-F4-findings.md` (#1, #11) para la recomendación de retro-alinear la
spec de F0.

## Alcance

- Modificar: `prisma/schema.prisma`
- Ejecutar (agente): `pnpm prisma generate`
- Fuera de alcance: cualquier servicio o UI; la migración la corre Roger.

## Detalle técnico

Cambios exactos en `prisma/schema.prisma`:

```prisma
model Payment {
  // orderId pasa de obligatorio a opcional:
  orderId       String?  @unique
  order         Order?   @relation(fields: [orderId], references: [id])
  // nuevos campos:
  paymentLinkId String?  @unique
  paymentLink   PaymentLink? @relation(fields: [paymentLinkId], references: [id])
  businessId    String
  business      Business @relation(fields: [businessId], references: [id])
  stripeChargeId String? @unique // cargo origen para source_transaction del Transfer

  @@index([businessId, status])
  @@index([businessId, createdAt])
}

model PaymentLink {
  payment Payment?          // lado inverso
}

model Business {
  chargesEnabled Boolean @default(false)
  payoutsEnabled Boolean @default(false)
  payments       Payment[]  // lado inverso
}
```

- El ledger de `XC-25` (`providerAmountCents`, `serviceFeeCentsApplied`,
  `providerRefundedCents`, `serviceFeeRefundedCents`) se conserva sin redeclararlo. El resto
  de `Payment` (`commissionPctApplied`, `commissionCents`, `refundedCents`,
  `stripePaymentIntentId`, `stripeTransferId`, `escrowReleaseAt`, `releasedAt`) queda igual.
- Sustituir el índice simple del cron por
  `@@index([status, escrowReleaseAt])`; conservar los índices de tenant.
- Invariante `orderId XOR paymentLinkId`: además de validación de servicio, la migración
  debe incluir un `CHECK` SQL revisado y ejecutado por Roger. El agente no ejecuta SQL.
- La relación contable `Payment.business` no debe usar `onDelete: Cascade`; conservar pagos
  históricos requiere `Restrict` (o la política contable que ya haya fijado F0).
- Actualizar el seed **solo si** ya crea `Payment` (F0 §9 lo hace): cada pago del seed debe
  llevar `businessId` del negocio de su orden.
- Antes de hacer `businessId` requerido en una BD con filas, la migración de Roger debe:
  agregarlo nullable, backfill desde la orden/link, verificar cero nulos y recién entonces
  aplicar `NOT NULL`. No usar un default de tenant.
- Decisiones posteriores ya cerradas por Roger:
  - Los refunds distribuyen principal y tarifa proporcionalmente según F3-05; este ticket
    no altera los snapshots congelados ni su significado.
  - F3-08 adopta Stripe Payment Links API persistente: `PaymentLinkStatus` es
    `CREATING|ACTIVE|INACTIVE`, `stripeUrl` es nullable y el id remoto único se llama
    `stripePaymentLinkId`. `paidAt` conserva el hecho de pago.
  - `PENDIENTES.md` #3 y XC-08 adoptan Payout manual: `Withdrawal.stripePayoutId` identifica
    exclusivamente el Payout y el enum incorpora estados de claim/reconciliación.

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

- [ ] `pnpm prisma generate`, `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] `Payment` acepta exactamente orden **o** link; CHECK de BD y validación de servicio
      coinciden; `businessId` presente siempre.
- [ ] `Business` expone `chargesEnabled`/`payoutsEnabled` con default `false`.
- [ ] Seed compila y asigna `businessId` a todos los pagos existentes sin perder los
      componentes del ledger de `XC-25`.

## Comandos para Roger (si aplica)

```bash
pnpm prisma migrate dev --create-only --name payment_links_business_denorm_connect_flags
# Roger revisa/backfillea la migración y luego ejecuta:
pnpm prisma migrate dev
pnpm db:seed
```
