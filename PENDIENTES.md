# Decisiones cerradas del flujo de dinero

Las cinco decisiones iniciales que bloqueaban contratos de F3 quedaron aprobadas por Roger
el 2026-08-03. El 2026-08-04 se cerraron además la devolución de la tarifa plana y el alcance
de refunds sobre pagos ya liberados. Este documento deja de ser una lista de opciones: es el
registro normativo que deben consumir los tickets de pagos, saldos, retiros y links de cobro.

## 1. Reembolso parcial: comisión proporcional

La plataforma conserva comisión únicamente sobre el principal que el proveedor retiene:

```text
retainedProviderCents = providerAmountCents - providerRefundedCents
effectiveCommissionCents = round(
  retainedProviderCents * commissionPctApplied / 100
)
providerNetCents = retainedProviderCents - effectiveCommissionCents
```

`Payment.commissionCents` se actualiza a la comisión efectivamente retenida. El bono D3 se
recalcula sobre esa misma comisión. Un reembolso total aporta comisión y bono cero. La
asignación entre principal y tarifa de servicio sigue siendo explícita mediante
`providerRefundedCents` y `serviceFeeRefundedCents`; nunca se infiere de un monto opaco.

## 2. Saldo disponible: neto según XC-03

Se adopta la fórmula neta de XC-03:

```text
Disponible = Σ providerNetCents(p)
  para p.status ∈ {RELEASED, PARTIALLY_REFUNDED}
  - Σ w.amountCents
  para w.status ∈ {REQUESTED, PROCESSING, APPROVED}

En escrow = Σ p.amountCents para p.status ∈ {IN_ESCROW, REFUNDING, RELEASING}
Comisión del mes = Σ comisión efectivamente retenida de pagos del mes
```

`REJECTED`, `FAILED` y `CANCELED` no reservan saldo. El disponible no incluye comisión,
tarifa plana ni bonos de lealtad, y nunca se clampa a cero.

## 3. Retiros: payouts manuales con aprobación

Se adopta la rama A de XC-08:

- `releasePayment` conserva el `Transfer` que mueve el neto a Connect.
- El negocio solicita un retiro y el admin lo aprueba o rechaza.
- Aprobar crea un Stripe `Payout` en la cuenta Connect, nunca otro `Transfer`.
- El id externo se persiste en `Withdrawal.stripePayoutId`.
- Idempotency key: `payout-withdrawal-${withdrawalId}`.
- El claim congela `payoutStripeAccountId`; un retry `PROCESSING` usa esa cuenta aunque
  cambien después el status, `payoutsEnabled` o `stripeAccountId` del negocio.
- Máquina operativa: `REQUESTED → PROCESSING → APPROVED` o
  `REQUESTED → REJECTED`; eventos Stripe pueden reconciliar `PROCESSING|APPROVED` a
  `FAILED|CANCELED`.

## 4. Links de cobro: Stripe Payment Links API persistente

Se usa Stripe Payment Links API, no una Checkout Session efímera como recurso local. Cada
link es de un solo uso mediante `restrictions.completed_sessions.limit: 1` para respetar
la relación `PaymentLink.payment` 1:1.

- Estado local: `CREATING | ACTIVE | INACTIVE`.
- `CREATING` es no compartible, reintentable y reconciliable con la idempotency key
  `payment-link-${paymentLinkId}`.
- El objeto remoto se guarda en `stripePaymentLinkId`; su URL en `stripeUrl` nullable.
- La fila congela `serviceFeeCentsApplied` y `successUrl`; reconciliar nunca vuelve a leer
  tarifa, locale ni base URL actuales.
- `paidAt` sigue siendo el hecho de pago y no se duplica como estado.
- Metadata de tenant, link y componentes monetarios se configura tanto en el Payment Link
  como en `payment_intent_data.metadata`; la BD siempre autoriza tenant y monto.
- Un fallo tras crear la fila devuelve `recovery.paymentLinkId`; el caller reconcilia ese
  `CREATING` y no inicia otra creación.

## 5. Captura sin suscripción activa

`capturePayment` rechaza la captura si el negocio no tiene una suscripción con status
`ACTIVE`. Retorna el código estable existente `BUSINESS_NOT_ACTIVE` (403); no usa fallback
al plan basic, porcentaje cero ni configuración global. El webhook debe propagar el fallo
para que Stripe reintente o el flujo sea atendido explícitamente.

## 6. Refund de la tarifa plana

- Un reembolso **total** devuelve el principal completo y el total de
  `serviceFeeCentsApplied`; deja `providerRefundedCents = providerAmountCents`,
  `serviceFeeRefundedCents = serviceFeeCentsApplied` y `refundedCents = amountCents`.
- Un reembolso **parcial** devuelve únicamente la porción de tarifa indicada explícitamente
  por el caller autorizado. El input debe separar `providerRefundCents` y
  `serviceFeeRefundCents`, incluso cuando uno de ellos sea cero; nunca se reparte ni se
  prorratea la tarifa de forma implícita.
- Todo componente se valida contra su saldo no reembolsado. La suma de ambos componentes es
  el monto exacto enviado a Stripe y persistido en `refundedCents`.

## 7. Pagos ya liberados

F3 rechaza todo refund cuando `Payment.status === RELEASED` con
`PAYMENT_NOT_REFUNDABLE`. F3 no crea `Transfer Reversal`, no simula la recuperación del
saldo Connect y no modifica el ledger local de un pago liberado. El soporte de refunds
posteriores a la liberación requiere un ticket independiente que implemente y reconcilie
Stripe Transfer Reversal antes de habilitar ese flujo.

## Pendiente independiente para F5

El placeholder de onboarding de Stripe Connect sigue siendo un bug separado: F5-05 debe
mostrar/completar onboarding según `chargesEnabled` y `payoutsEnabled`, no según la mera
presencia de `stripeAccountId`.

## Contrato operativo de liberación

`RELEASING` es el punto de no retorno local de una liberación: se reclama mediante CAS
desde `IN_ESCROW`, con el ledger sin reembolsos y sin disputa abierta, antes de llamar a
Stripe. Un retry conserva el estado y reutiliza `transfer-payment-${paymentId}`. Mientras
un pago esté `RELEASING`, no se puede abrir/reabrir una disputa ni iniciar un reembolso;
el caller debe esperar su reconciliación a `RELEASED` o una intervención operativa.
`REFUNDING` aplica el mismo principio al flujo de refund: F3-05 debe reclamar por CAS desde
`IN_ESCROW` antes de llamar a Stripe y reutilizar sus claves determinísticas en cada retry.
Crear o reabrir una disputa debe ocurrir en una transacción serializable que escriba el
`Payment` aún `IN_ESCROW` y cree la disputa; así compite atómicamente con el CAS de release.
`REFUNDING|RELEASING` siguen contando como dinero en escrow, nunca como saldo disponible.

## Resumen

| Contrato | Decisión aprobada |
|---|---|
| Comisión parcial | Proporcional al principal retenido |
| Disponible | Neto XC-03; incluye `PARTIALLY_REFUNDED` |
| Retiros | Payout manual solicitado y aprobado |
| Links | Payment Links API persistente, single-use |
| Captura sin suscripción activa | Rechazar con `BUSINESS_NOT_ACTIVE` |
| Tarifa plana en refund | Total: completa; parcial: solo porción explícita autorizada |
| Refund de pago `RELEASED` | Rechazar; Transfer Reversal queda en ticket separado |
