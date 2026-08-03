# Decisiones cerradas del flujo de dinero

Las cinco decisiones que bloqueaban contratos de F3 quedaron aprobadas por Roger el
2026-08-03. Este documento deja de ser una lista de opciones: es el registro normativo que
deben consumir los tickets de pagos, saldos, retiros y links de cobro.

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

En escrow = Σ p.amountCents para p.status = IN_ESCROW
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
- `paidAt` sigue siendo el hecho de pago y no se duplica como estado.
- Metadata de tenant, link y componentes monetarios se configura tanto en el Payment Link
  como en `payment_intent_data.metadata`; la BD siempre autoriza tenant y monto.

## 5. Captura sin suscripción activa

`capturePayment` rechaza la captura si el negocio no tiene una suscripción con status
`ACTIVE`. Retorna el código estable existente `BUSINESS_NOT_ACTIVE` (403); no usa fallback
al plan basic, porcentaje cero ni configuración global. El webhook debe propagar el fallo
para que Stripe reintente o el flujo sea atendido explícitamente.

## Pendiente independiente para F5

El placeholder de onboarding de Stripe Connect sigue siendo un bug separado: F5-05 debe
mostrar/completar onboarding según `chargesEnabled` y `payoutsEnabled`, no según la mera
presencia de `stripeAccountId`.

## Resumen

| Contrato | Decisión aprobada |
|---|---|
| Comisión parcial | Proporcional al principal retenido |
| Disponible | Neto XC-03; incluye `PARTIALLY_REFUNDED` |
| Retiros | Payout manual solicitado y aprobado |
| Links | Payment Links API persistente, single-use |
| Captura sin suscripción activa | Rechazar con `BUSINESS_NOT_ACTIVE` |
