# [F8-05] Catálogo de modelos, precio por token y créditos IA

## Metadatos

- **Fase:** F8 — Asistente operativo
- **Spec origen:** decisión del owner (2026-09-23): "solo deja `spacexai/grok-4.7`,
  `openai/gpt-6-luna` y `typesafe-ai/jev`; jev gratuito por el momento; los demás se cobran
  en la factura final por tokens; duplicamos el precio de tokens; el usuario podrá comprar
  tokens y tenerlos en su cuenta, la lógica de precios la manejamos nosotros".
- **Depende de:** F8-01. **Bloquea:** F9-01 (sección Facturación IA).
- **Tamaño:** M
- **Estado:** planeado; pendiente de confirmación D1–D4.

## Hechos verificados contra AI Gateway (`/v1/models`, 2026-09-23)

| Modelo | Contexto | Entrada USD/M | Salida USD/M | Nota |
|--------|----------|---------------|--------------|------|
| `openai/gpt-6-luna` | 1 050 000 | 0.10 | 0.50 | Tool-use, visión, reasoning. Tarifa sube al doble por encima de 272 001 tokens de contexto. |
| `spacexai/grok-4.7` | 500 000 | 1.20 | 3.60 | Tool-use, reasoning. Tarifa sube al doble por encima de 200 001 tokens. |
| `typesafe-ai/jev` | 32 000 | 0.042 | 0 | **Tipo `evaluation`**, sin tag `tool-use`, `max_tokens: 0`, solo spec v4. |

> **Riesgo a confirmar antes de implementar:** `typesafe-ai/jev` es un modelo de evaluación
> (clasificación/scoring), no un modelo de chat con herramientas. Es muy probable que el
> `ToolLoopAgent` falle o responda vacío con él. Propuesta: incluirlo en el catálogo como
> pide el owner, marcado **Gratis**, pero verificar con una llamada real antes de dejarlo
> como opción por defecto. Mientras no se verifique, el default es `openai/gpt-6-luna`
> (el más barato con herramientas).

## Reglas de precio (normativas)

- **Precio HOME360 = precio del gateway × 2** (`AI_PRICE_MARKUP = 2`, constante en
  `src/lib/agent/agent-pricing.ts`). Resultado: luna 0.20 / 1.00 USD por M; grok 2.40 / 7.20
  USD por M; jev 0 (gratis "por el momento": el costo real de entrada, 0.042 USD/M, lo
  absorbe la plataforma).
- Se cobra por **tokens reales reportados** por el gateway en el evento `finish`
  (`inputTokens`, `outputTokens`); los tokens de caché se cobran como entrada (simple y
  conservador, D2).
- Conversión a MXN con `PlatformSettings.aiUsdMxnRate` (editable en `/admin/settings`,
  sección IA), congelada en cada fila del ledger. Todo importe en **centavos MXN** como el
  resto del dinero de la plataforma.
- Orden de cobro por turno: (1) saldo prepagado del tenant; (2) el remanente se acumula
  como **pendiente por facturar** y se agrega a la siguiente factura de Stripe Billing del
  tenant (suscripción del negocio o membresía corporativa). Admin: sin cargo, solo ledger.
- Tope de pospago `PlatformSettings.aiPostpaidLimitCents` (default 2 000 00 = $2 000 MXN):
  al alcanzarlo, el chat responde `AI_CREDIT_LIMIT_REACHED` y la UI ofrece comprar tokens.

## Alcance

### `src/lib/agent/`

- `agent-models.ts`: catálogo de **tres** entradas con `contextWindow` real, `pricing`
  base del gateway (`inputUsdPerMillion`, `outputUsdPerMillion`), `free: boolean`,
  `supportsTools: boolean`. `DEFAULT_AGENT_MODEL_ID` según D1.
- `agent-pricing.ts` (isomórfico): `AI_PRICE_MARKUP`, `platformPricePerMillion(model)`,
  `estimateTurnCostMxnCents({ model, usage, usdMxnRate })`, `formatTokens`.

### Prisma (Roger ejecuta `pnpm db:push`)

```prisma
model Business         { aiCreditCents Int @default(0)  aiUsage AiUsage[]  aiCreditPurchases AiCreditPurchase[] }
model CorporateAccount { aiCreditCents Int @default(0)  aiUsage AiUsage[]  aiCreditPurchases AiCreditPurchase[] }
model PlatformSettings { aiUsdMxnRate Decimal @default(18.50) @db.Decimal(8, 4)  aiPostpaidLimitCents Int @default(200000) }

enum AiUsageSettlement { PREPAID INVOICE INTERNAL }

model AiUsage {
  id                 String            @id @default(cuid())
  userId             String
  user               User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessId         String?
  business           Business?         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  corporateAccountId String?
  corporateAccount   CorporateAccount? @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)
  conversationId     String?
  model              String
  inputTokens        Int
  outputTokens       Int
  usdMxnRate         Decimal           @db.Decimal(8, 4)
  costCents          Int               // precio HOME360 (×2) en MXN
  settlement         AiUsageSettlement
  stripeInvoiceItemId String?          // cuando settlement = INVOICE y ya se adjuntó
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  @@index([businessId, createdAt])
  @@index([corporateAccountId, createdAt])
  @@index([userId, createdAt])
  @@index([settlement, stripeInvoiceItemId])
}

enum AiCreditPurchaseStatus { PENDING PAID FAILED }

model AiCreditPurchase {
  id                      String                 @id @default(cuid())
  businessId              String?
  business                Business?              @relation(fields: [businessId], references: [id], onDelete: Cascade)
  corporateAccountId      String?
  corporateAccount        CorporateAccount?      @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)
  packCode                String                 // "S" | "M" | "L"
  amountCents             Int                    // pagado
  creditCents             Int                    // acreditado (== amountCents; los paquetes no regalan tokens, D3)
  status                  AiCreditPurchaseStatus
  stripeCheckoutSessionId String                 @unique
  stripePaymentIntentId   String?                @unique
  paidAt                  DateTime?
  createdAt               DateTime               @default(now())
  updatedAt               DateTime               @updatedAt

  @@index([businessId, createdAt])
  @@index([corporateAccountId, createdAt])
}
```

### Servicios (`src/server/services/ai-billing/`)

- `credit-packs.ts` — paquetes fijos en MXN (D3): `S` $200, `M` $500, `L` $1 000.
- `record-usage.ts` — transacción: calcula costo, debita `aiCreditCents` hasta donde
  alcance (`settlement = PREPAID`), el resto `INVOICE`; admin → `INTERNAL` con costo
  informativo. Idempotente por `(conversationId, messageId)`.
- `check-allowance.ts` — antes de cada turno: modelo gratis → ok; saldo > 0 → ok;
  pendiente < tope → ok; si no `AI_CREDIT_LIMIT_REACHED`.
- `create-credit-checkout.ts` — Stripe Checkout `mode: "payment"`, `currency: "mxn"`,
  `metadata.aiCreditPurchaseId`, cliente Billing existente (`stripeCustomerId`).
- `apply-credit-purchase.ts` — llamado desde el webhook `checkout.session.completed`
  (extender `checkoutSessionMetadataSchema` con `aiCreditPurchaseId`); acredita una sola
  vez (`status PENDING → PAID`).
- `attach-usage-to-invoice.ts` — cron diario (`src/app/api/cron/ai-usage-invoice`): por
  tenant con `INVOICE` sin `stripeInvoiceItemId`, crea **un** `invoiceItems.create`
  (customer, `currency: "mxn"`, descripción "Asistente IA — N tokens") y marca las filas.
  Stripe lo incluye en la siguiente factura de la suscripción/membresía ("factura final").
- `usage-summary.ts` — saldo, pendiente, uso del mes por modelo, ledger paginado por
  cursor, compras.

### Router `aiBilling` (`src/server/api/routers/ai-billing.ts`)

`protectedProcedure` con resolución de tenant por rol (business → `Business`, corporate →
`CorporateAccount`, admin → interno): `getSummary`, `listUsage`, `listPurchases`,
`createCreditCheckout` (403 para admin e impersonación). Contrato `TrpcResponse`.

### Ruta del chat (`src/app/api/agent/chat/route.ts`)

- Allow-list ya existente (`isAgentModelId`) + `checkAllowance` antes de crear el agente
  (503 `AI_CREDIT_LIMIT_REACHED` con cuerpo JSON que la UI traduce).
- `onFinish` de `createAgentUIStreamResponse` → `recordUsage` con `totalUsage`. El
  metadata del mensaje añade `costCents` y `settlement` para que el `UsageMeter` muestre
  el costo del turno.

### UI mínima de este ticket (el resto vive en F9-01)

- `agent-chat.tsx`: el picker muestra badge **Gratis** (jev) o precio por M tokens
  (nuestro), y el `UsageMeter` añade el costo del turno en MXN. Un aviso inline cuando el
  saldo se agota, con enlace a `/{panel}/profile#billing`.
- `/admin/settings` sección IA: campos `aiUsdMxnRate` y `aiPostpaidLimitCents` (rangos en
  `settings.schema.ts`).
- `.env.example`: comentario de `AGENT_MODEL` actualizado al nuevo default.

## Decisiones abiertas

- **D1. Default:** `openai/gpt-6-luna` (propuesto, barato y con tools) vs. `typesafe-ai/jev`
  (gratis pero probablemente incapaz de usar herramientas).
- **D2. Tokens de caché:** cobrar como entrada (propuesto) vs. tarifa de caché ×2.
- **D3. Paquetes:** $200 / $500 / $1 000 MXN sin bonificación (propuesto) vs. bonificar
  el paquete grande.
- **D4. Tipo de cambio:** fijo editable en settings (propuesto) vs. consulta diaria a un
  proveedor de FX (nueva dependencia externa, no recomendada para el lanzamiento).
