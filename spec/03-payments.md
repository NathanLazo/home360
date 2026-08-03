# F3 — Pagos: Stripe Connect, escrow, links de cobro y retiros

Cubre **W6 (cobros)** y la infraestructura de dinero que consumen F4 y F5. Requiere F2.
Stripe en modo test.

## 1. Arquitectura de dinero

```text
Cliente paga (app móvil / link) ──▶ PaymentIntent en cuenta PLATAFORMA
                                        │  Payment.status = IN_ESCROW
             confirmación del cliente ──┤  o auto-liberación (escrowAutoReleaseHours)
                                        ▼
            Transfer (principal neto − comisión) ──▶ cuenta Connect del negocio
                                        │  Payment.status = RELEASED
                 salida bancaria según decisión 3 de PENDIENTES / XC-08
```

- **Separate charges & transfers**: el cargo entra a la plataforma; el escrow es el saldo
  retenido hasta liberar; al liberar se crea el `Transfer` hacia `stripeAccountId` por
  `providerAmountCents − providerRefundedCents − commissionCents`. `amountCents` incluye la
  tarifa plana y no es base del transfer (`XC-25`).
- La comisión se **congela** al crear el `Payment` (`commissionPctApplied` +
  `commissionCents`) leyendo el plan vigente del negocio en ese momento.
- Reembolsos (total/parcial, desde disputas F5): asignación explícita entre principal y
  tarifa; la política exacta sigue bloqueada en `PENDIENTES.md`/`XC-25`.
- Saldos derivados (nunca columna persistida):
  - **Disponible** = proyección de principal neto según `XC-03`, `XC-08` y `XC-27`.
  - **En escrow** = Σ `IN_ESCROW`.
  - **Comisión del mes** = Σ `commissionCents` de pagos del mes.

## 2. Servicios (`src/server/services/`)

Todos reciben `stripe` y `db` por parámetro (inyección para tests):

- `stripe/connect.ts` — `createConnectAccount`, `createOnboardingLink`,
  `getAccountStatus` (charges/payouts habilitados).
- `payments/escrow.ts` — `capturePayment` (registra Payment IN_ESCROW + calcula comisión),
  `releasePayment` (Transfer + RELEASED, transacción), `refundPayment(full|partialCents)`.
  `releasePayment` es la **única** vía de mover dinero al negocio (la usan cliente-confirma,
  auto-release y resolución de disputas).
- `payments/payment-links.ts` — Stripe Checkout Session (`payment` mode) con
  `metadata: { paymentLinkId, businessId }`; persiste `PaymentLink`.
- `payments/withdrawals.ts` — `requestWithdrawal` (valida saldo disponible ≥ monto →
  `INSUFFICIENT_BALANCE`), `approveWithdrawal` / `rejectWithdrawal` (admin, F5).
- `payments/balances.ts` — `getBusinessBalances(businessId)`: los 3 saldos derivados en
  una sola pasada de agregaciones.

## 3. Onboarding Connect

- Al aprobarse un negocio (F5) o al entrar a `/dashboard/payments` sin
  `stripeAccountId`: banner "Conecta tu cuenta para recibir pagos" → mutation
  `payment.startOnboarding` → `createConnectAccount` (tipo Express, MX) + onboarding link →
  redirect a Stripe → return URL `/dashboard/payments?onboarding=complete`.
- Sin cuenta conectada: puede cobrar (el dinero entra a plataforma) pero **no** liberar ni
  retirar; la UI lo comunica con un `Alert`.

## 4. Router `payment` (business)

| Procedure | Proc | Input | Result / Errores |
|-----------|------|-------|------------------|
| `getBalances` | business | — | `{ availableCents, escrowCents, monthCommissionCents, escrowOrdersCount }` |
| `listTransactions` | business | `{ status?, method?, cursor? }` | cliente, concepto, monto, método, estado, fecha |
| `startOnboarding` | active | — | `{ url }` · `STRIPE_ERROR` |
| `createPaymentLink` | active | `{ concept, amountCents }` | `{ id, url }` |
| `requestWithdrawal` | active | `{ amountCents, bankName, accountLast4 }` | `{ id }` · `INSUFFICIENT_BALANCE` |
| `confirmDelivery` | user (móvil, futuro) | `{ orderId }` | libera escrow |

## 5. Webhooks — `src/app/api/webhooks/stripe/route.ts`

- Verificación de firma con `STRIPE_WEBHOOK_SECRET` sobre el raw body.
- Handlers **idempotentes** (cada uno re-consulta estado antes de escribir; los eventos
  duplicados no dobletean):
  - `payment_intent.succeeded` → `capturePayment` (crea/actualiza Payment IN_ESCROW,
    fija `escrowReleaseAt = now + escrowAutoReleaseHours`).
  - `checkout.session.completed` → marca `PaymentLink.paidAt` + Payment del link.
  - `charge.refunded` → sincroniza `refundedCents`/status.
  - `account.updated` → refresca capacidad de payouts del negocio.
- Eventos no manejados → 200 sin efecto. Errores → 500 (Stripe reintenta).
- **Auto-liberación**: `releaseDuePayments()` en `payments/escrow.ts` libera pagos con
  `escrowReleaseAt <= now`; se expone como route handler `api/cron/release-escrow`
  protegido por `CRON_SECRET` (header), invocable por Vercel Cron o manualmente.

## 6. UI — W6 `/dashboard/payments`

```text
payments/  page.tsx · loading.tsx · error.tsx  +  _components/
├─ payments-view.tsx
├─ payments-header-actions.tsx   # "Crear link de cobro" + "Retirar $X"
├─ balance-cards.tsx             # Disponible / Retenido en escrow / Comisión del mes (8%)
├─ transactions-table.tsx        # cliente, concepto, monto, método, estado, fecha
├─ payment-status-badge.tsx      # En escrow (ámbar) · Pagado (azul) · Liberado (verde) · Reembolsado (gris)
├─ create-payment-link-dialog.tsx# Dialog: concepto + monto → muestra URL copiable
├─ withdraw-dialog.tsx           # Dialog: monto (máx. disponible), banco, últimos 4 → confirmación
├─ connect-onboarding-banner.tsx # Alert si falta stripeAccountId
├─ payment.schema.ts · payment.types.ts
└─ use-payment-mutations.ts
```

Fechas relativas ("Hoy, 1:13 pm") con `useFormatter().relativeTime` / formato del diseño.
El botón "Retirar" muestra el disponible en vivo; monto solicitado > disponible se
bloquea client-side y se revalida server-side.

## 7. Pruebas

- `escrow.test.ts` (fakes de stripe/db): comisión congelada aunque el plan cambie después;
  release crea transfer por el neto exacto; refund parcial libera el resto; release
  idempotente (segundo call no transfiere de nuevo).
- `balances.test.ts`: disponible descuenta retiros REQUESTED y APPROVED.
- `withdrawals.test.ts`: `INSUFFICIENT_BALANCE`.
- Webhook: firma inválida → 400; evento duplicado → sin doble efecto.

## 8. Verificación y comandos de Roger

1. `pnpm typecheck` · `pnpm check` · `pnpm vitest run`.
2. Roger:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Flujo manual test-mode: onboarding Express de prueba → crear link de cobro → pagarlo
   con tarjeta `4242…` → webhook lo marca pagado → aparece IN_ESCROW → forzar
   `release-escrow` → RELEASED → solicitar retiro → REQUESTED (se aprueba en F5).

### Criterios de aceptación

- [ ] W6 replica el diseño: 3 tarjetas de saldo, tabla, acciones de header.
- [ ] Ningún monto se calcula en el cliente; saldos siempre derivados en servidor.
- [ ] Webhooks idempotentes y con firma verificada.
- [ ] Número de cuenta: solo banco + últimos 4 en BD y UI.
- [ ] Comisión congelada por pago, coherente con el plan al momento del cobro.
