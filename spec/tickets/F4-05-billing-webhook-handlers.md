# [F4-05] Handlers de webhook de Billing (`invoice.*`, `customer.subscription.*`)

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §2 (webhooks), §6; `spec/03-payments.md` §5
- **Depende de**: `F3-09` (dispatcher extensible), `F4-03` (mapeo de estados)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Stripe es la fuente de verdad del ciclo de facturación; estos handlers reflejan sus
eventos en `Subscription` e `Invoice`. Extienden el dispatcher de F3-09 **sin tocar**
`src/app/api/webhooks/stripe/route.ts` (criterio de aceptación de F3-09).

**Problemas detectados en la spec, resueltos aquí:**

1. §2 no dice cómo se localiza la suscripción local desde una factura. **Resolución**:
   1.º por `stripeSubscriptionId` del payload, 2.º por `Business.stripeCustomerId` a partir
   de `invoice.customer`. Sin match → `svcOk` (evento ajeno: la plataforma también recibe
   eventos de PaymentIntents de escrow que no son de Billing).
2. La ubicación del id de suscripción dentro de `Invoice` cambió entre versiones de la API
   (`invoice.subscription` vs. `invoice.parent.subscription_details.subscription`).
   **Resolución**: helper único `resolveInvoiceSubscriptionId(invoice)` con narrowing sobre
   los tipos del SDK instalado (sin `any` ni casts); es el único punto a tocar si Roger
   cambia `apiVersion`. Ver `F3-F4-findings.md` #17.
3. `invoice.payment_failed` no cubre por sí solo todos los mecanismos de cobro: la mora
   también se manifiesta como `customer.subscription.updated` con status
   `past_due`. **Resolución**: ambos caminos escriben `PAST_DUE`; el estado se sincroniza
   siempre desde el objeto `Subscription` de Stripe (escritura absoluta, idempotente).
4. `InvoiceStatus` local tiene 3 valores y Stripe 5. **Resolución**: tabla de mapeo
   explícita (abajo), sin `default`.
5. Duplicado no es el único orden posible: Stripe puede reenviar eventos viejos. Una
   `invoice.payment_failed` tardía no puede degradar una factura ya `PAID`, y un
   `customer.subscription.updated` viejo no puede revivir el mismo id remoto después de
   `customer.subscription.deleted`. Las transiciones terminales se protegen abajo.
6. Stripe expone `uncollectible`, pero el enum local no distingue deuda incobrable de
   factura abierta. Hasta que se amplíe el modelo, se conserva como `OPEN` (no cuenta como
   ingreso `PAID`) y la traducción visible debe ser "Pendiente/no pagada", no prometer que
   todavía es cobrable. La facturación fiscal y su tratamiento contable siguen bloqueados.
7. `cancel_at_period_end`/`canceled_at` no tienen campos locales (findings #20). El handler
   no descarta esos datos por accidente: registra un warning estructurado y mantiene
   status/`renewsAt`; exponer cancelación programada requiere la decisión y migración futuras.

## Alcance

Crear:

- `src/server/services/subscription/sync-subscription.ts`
- `src/server/services/stripe/handlers/invoice-paid.ts`
- `src/server/services/stripe/handlers/invoice-payment-failed.ts`
- `src/server/services/stripe/handlers/invoice-finalized.ts`
- `src/server/services/stripe/handlers/invoice-voided.ts`
- `src/server/services/stripe/handlers/customer-subscription-updated.ts`
- `src/server/services/stripe/handlers/customer-subscription-deleted.ts`
- `src/server/services/stripe/handlers/billing-handlers.ts` (mapa de registro)

Modificar:

- `src/server/services/stripe/webhook-dispatcher.ts` — un import + una llamada a
  `registerStripeHandlers(billingHandlers)`. **No** se modifica el route handler.

Fuera de alcance: router `subscription` (F4-06), UI (F4-08…F4-10), eventos de Connect/escrow (F3-09).

## Detalle técnico

### `sync-subscription.ts`

```ts
syncSubscriptionFromStripe(
  deps: { db: PrismaClient },
  stripeSubscription: Stripe.Subscription,
): Promise<ServiceResult<{ subscriptionId: string | null }>>
```

1. Localizar la `Subscription` local por `stripeSubscriptionId`; si no existe, por
   `business.stripeCustomerId === stripeSubscription.customer` (string id). Sin match →
   `svcOk({ subscriptionId: null })` (evento ajeno, no es error).
2. Resolver el plan: `Plan.stripePriceId === items.data[0].price.id`. Si el price no
   corresponde a ningún `Plan` (p. ej. un Price rotado por `sync-stripe-plans`, F4-01) →
   **no** se cambia `planId` (se conserva el local) y se registra un log server-side.
3. `db.subscription.update(...)` con escritura absoluta, salvo esta protección de orden:
   si la fila local ya está `CANCELED` para el **mismo** `stripeSubscriptionId`, un evento
   no cancelado no la reactiva. La reactivación futura, si Roger la adopta, debe crear o
   vincular explícitamente el nuevo ciclo/id; no se infiere de un evento viejo.

### Handlers (firma `StripeEventHandler` de F3-09)

| Evento | Comportamiento |
|--------|----------------|
| `invoice.paid` | `upsertInvoiceFromStripe(PAID)` + `stripe.subscriptions.retrieve` → `syncSubscriptionFromStripe` (actualiza `status` y `renewsAt`) |
| `invoice.payment_failed` | Upsert `OPEN` sin degradar una fila ya `PAID` + `db.subscription.updateMany({ where: { id, status: { not: "CANCELED" } }, data: { status: "PAST_DUE" } })` |
| `invoice.finalized` | Upsert `OPEN`; permite listar y descargar la factura antes del pago |
| `invoice.voided` | Upsert `VOID`, salvo que la fila ya esté `PAID`; nunca revierte ingreso reconocido por un evento tardío |
| `customer.subscription.updated` | `syncSubscriptionFromStripe(event.data.object)` |
| `customer.subscription.deleted` | `syncSubscriptionFromStripe(...)` (el status llega `canceled` → `CANCELED`); además `renewsAt` se conserva tal cual |

`upsertInvoiceFromStripe(deps, invoice, status)` (privado, en `invoice-paid.ts` y
reutilizado por `invoice-payment-failed.ts` vía import explícito):

```ts
db.invoice.upsert({
  where:  { stripeInvoiceId: invoice.id },
  create: { subscriptionId, stripeInvoiceId: invoice.id,
            amountCents: status === "PAID" ? invoice.amount_paid : invoice.amount_due,
            status, pdfUrl: invoice.invoice_pdf ?? null,
            issuedAt: new Date(invoice.created * 1000) },
  update: { amountCents: …, status, pdfUrl: … },   // absoluto, sin acumular
})
```

- Rechazar con `svcFail("CONFLICT")` y log si `invoice.currency !== "mxn"`; no persistir
  centavos de otra moneda como MXN.
- Para `OPEN`/`VOID`, el upsert crea si falta y actualiza monto/PDF, pero cambia `status`
  con `updateMany` condicionado a `status != PAID`. `PAID` siempre puede promover una fila
  previa y es terminal. Así duplicados y entregas fuera de orden convergen.
- Mapeo `Stripe.Invoice.Status` → `InvoiceStatus` (usado si se sincroniza una factura
  cualquiera): `paid → PAID`; `open | draft | uncollectible → OPEN`; `void → VOID`.
- **Idempotencia**: `Invoice.stripeInvoiceId` es `@unique` (F0 §3) → un `invoice.paid`
  duplicado hace `update` sobre la misma fila; nunca se crea una segunda (spec §6).
- Sin `subscriptionId` local resoluble → `svcOk` sin escribir (no se crea una `Invoice`
  huérfana: el modelo exige `subscriptionId`).
- Ningún handler confía en metadata para autorizar: el tenant siempre sale de la BD
  (misma regla que F3-09).
- Errores inesperados → `svcFail` para que el route handler responda 500 y Stripe reintente.

### `billing-handlers.ts`

```ts
export const billingHandlers: Record<string, StripeEventHandler> = {
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "invoice.finalized": handleInvoiceFinalized,
  "invoice.voided": handleInvoiceVoided,
  "customer.subscription.updated": handleCustomerSubscriptionUpdated,
  "customer.subscription.deleted": handleCustomerSubscriptionDeleted,
};
```

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; `unknown` + narrowing para el payload.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] `src/app/api/webhooks/stripe/route.ts` queda **intacto**.
- [ ] Evento duplicado de `invoice.paid` → una sola `Invoice` (upsert por `stripeInvoiceId`).
- [ ] Todas las escrituras son absolutas o condicionales (reprocesar no dobletea).
- [ ] Eventos fuera de orden no degradan `Invoice.PAID` ni reviven una suscripción cancelada.
- [ ] Eventos de Billing ajenos a la plataforma → 200 sin efecto.

## Comandos para Roger (si aplica)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger invoice.paid
```
