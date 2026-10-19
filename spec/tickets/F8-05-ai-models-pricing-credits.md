# [F8-05] Catálogo de modelos, precio por token y créditos IA

## Metadatos

- **Fase:** F8 — Asistente operativo
- **Depende de:** F8-01. **Alimenta:** F9-01 (sección Facturación IA).
- **Estado:** implementado. Pendiente solo operativo (ver abajo).

## Decisiones cerradas (owner, 2026-10-18)

1. **Solo prepago en USD.** No hay pospago, cargo en factura de Stripe Billing, tipo de
   cambio USD→MXN ni tope de pospago. Se descartan `aiUsdMxnRate`,
   `aiPostpaidLimitCents`, el settlement `INVOICE`, `attach-usage-to-invoice.ts` y el cron
   `ai-usage-invoice`.
2. **Precio HOME360 = precio del gateway × 2** (`AI_PRICE_MARKUP`,
   `src/lib/agent/agent-pricing.ts`). Se cobra por tokens reales del evento `finish`.
3. **Crédito de bienvenida US$3** por tenant, una sola vez (`aiWelcomeCreditAt` es la
   marca de idempotencia). Saldo máximo US$1 000 (`AI_WALLET_MAX_USD_MICROS`).
4. **Paquetes** S/M/L = US$5 / 10 / 25, sin bonificación, cobrados con Stripe Checkout en
   USD (`credit-packs.ts`).

## Modelo implementado

| Pieza | Ubicación |
|-------|-----------|
| Catálogo (4 modelos, free → high) | `src/lib/agent/agent-models.ts` |
| Precio, conversión y formato (isomórfico) | `src/lib/agent/agent-pricing.ts` |
| Saldo por tenant en USD micros | `Business.aiCreditUsdMicros`, `CorporateAccount.aiCreditUsdMicros` |
| Ledger de uso | `AiUsage` con settlement `PREPAID \| FREE \| INTERNAL` |
| Compras | `AiCreditPurchase`, aplicada por `checkout.session.completed` |
| Servicios | `src/server/services/ai-billing/*` |
| tRPC | `aiBilling` (compra bloqueada para admin, 403) |
| Corte en chat | `checkAiAllowance` → `AI_CREDIT_REQUIRED` (402); `recordAiUsage` al terminar |

Catálogo vigente: `inclusionai/ling-3.0-flash-sante` (gratis, default; sustituye a
`typesafe-ai/jev`, que el gateway rechaza en chat), `nvidia/nemotron-3.5-lightning`,
`openai/gpt-6-luna`, `spacexai/grok-4.7`. Admin usa el asistente con settlement
`INTERNAL` (sin cargo, solo ledger); modelos gratis se registran como `FREE`.

## Pendiente (operativo, owner)

- `pnpm db:push` con los modelos `AiUsage` / `AiCreditPurchase` y los campos
  `aiCreditUsdMicros` / `aiWelcomeCreditAt`.
- Verificar en AI Gateway el precio de Ling: el comentario del catálogo indica gratis solo
  hasta 2026-10-04. Si ya cobra, actualizar `gatewayPricing` y `free` en
  `agent-models.ts`.
- Recorrido manual: compra de paquete con Stripe test → saldo acreditado → turno que
  descuenta → `AI_CREDIT_REQUIRED` al agotarse.
