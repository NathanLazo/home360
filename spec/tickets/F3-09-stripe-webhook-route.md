# [F3-09] Webhook de Stripe: firma sobre raw body y handlers idempotentes

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §5, §7; `spec/00-foundations.md` §6 (APIs fuera de `[locale]`)
- **Depende de**: `F3-02`, `F3-03`, `F3-04`, `F3-05`, `F3-08`, `XC-25`
- **Tamaño estimado**: L

## Contexto

Punto único de entrada de eventos Stripe. Correctitud crítica: la firma se verifica sobre
el **raw body**; en App Router eso significa `await req.text()` **antes** de cualquier
`req.json()` (no existe el problema del body parser de Pages Router, pero un `json()`
previo consumiría/alteraría el stream). El dispatcher se diseña extensible: F4 registrará
sus handlers de Billing sin tocar esta ruta. Cada handler es idempotente por sí mismo
(los servicios ya usan uniques + `updateMany` condicional).

## Alcance

- Crear: `src/app/api/webhooks/stripe/route.ts`
- Crear: `src/server/services/stripe/webhook-dispatcher.ts`
- Crear: `src/server/services/stripe/handlers/payment-intent-succeeded.ts`
- Crear: `src/server/services/stripe/handlers/checkout-session-completed.ts`
- Crear: `src/server/services/stripe/handlers/charge-refunded.ts`
- Crear: `src/server/services/stripe/handlers/account-updated.ts`
- Fuera de alcance: handlers de Billing (`invoice.*`, `customer.subscription.*`) — F4-05.

## Detalle técnico

`route.ts`:

```ts
export const runtime = "nodejs";          // crypto de verificación de firma

export async function POST(req: Request) {
  const payload = await req.text();       // RAW body, nunca req.json() antes
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch { return new Response("invalid signature", { status: 400 }); }
  const outcome = await dispatchStripeEvent({ db, stripe }, event);
  return outcome.ok
    ? Response.json({ received: true })                    // incluye "evento no manejado"
    : new Response("handler error", { status: 500 });      // Stripe reintenta
}
```

`webhook-dispatcher.ts`: `Record<string, StripeEventHandler>` tipado
(`type StripeEventHandler = (deps: { db; stripe }, event: Stripe.Event) => Promise<ServiceResult<null>>`)
+ `registerStripeHandlers(map)` para que F4 extienda. Evento sin handler → `svcOk(null)`.

Handlers (cada uno hace narrowing del `event.data.object` con el tipo de Stripe, sin casts
amplios; los ids/metadata desconocidos se tratan como `unknown` + validación Zod ligera):

- `payment_intent.succeeded` → exigir `status === "succeeded"`, `currency === "mxn"` y usar
  `amount_received` (no `amount` solicitado). Exigir `latest_charge` string y pasarlo como
  `stripeChargeId`. Leer `metadata` del PI: `{ orderId? }` o
  `{ paymentLinkId, businessId }`. Con `orderId`: resolver `businessId` desde la orden
  (query, no confiar en metadata para tenant). Con `paymentLinkId`: verificar que el link
  exista y pertenezca al `businessId` de su fila (la metadata solo localiza, la BD manda).
  Sin metadata reconocible → `svcOk` (evento ajeno, p. ej. suscripciones F4). Llamar
  `capturePayment` (idempotente por PI id) con `currency`, `amount_received`,
  `providerAmountCents` reconstruido desde la fuente persistida y validado contra metadata,
  `stripeChargeId` y
  `method: PAYMENT_LINK` o `CARD` según origen; el servicio vuelve a validar monto/tenant.
- `checkout.session.completed` → si `session.mode !== "payment"` o sin
  `metadata.paymentLinkId` → `svcOk` (las sessions de Billing pasan de largo).
  Exigir además `payment_status === "paid"`; una Session completada pero no pagada no
  marca `paidAt`.
  Exigir que `session.payment_link` sea string y coincida con el
  `stripePaymentLinkId` persistido. Solo después de validar link, tenant y monto ejecutar
  `updateMany({ where: { id: paymentLinkId, paidAt: null, status: ACTIVE },
  data: { paidAt: now, status: INACTIVE } })`. Después asegurar el Payment: tomar
  `session.payment_intent` (string), recuperar el PaymentIntent desde Stripe y llamar
  `capturePayment` con su `amount_received`/`currency` — cubre el orden inverso;
  si el PI event ya lo creó, `capturePayment` retorna sin efecto.
- `charge.refunded` → localizar Payment por `charge.payment_intent` y reconciliar en
  absoluto (no incremental) **delegando a F3-05**. Para parcial, cambiar solo el status
  puede omitir Transfer y LoyaltyBonus; para un pago ya `RELEASED`, incluso un refund total
  requiere una política separada de Transfer Reversal. Para pagos no liberados, F3-05 aplica
  la comisión proporcional cerrada y el balance neto de XC-03.
- `account.updated` → localizar Business por `account.id` (`stripeAccountId`); actualizar
  `chargesEnabled`/`payoutsEnabled` desde `charges_enabled`/`payouts_enabled` (absoluto,
  idempotente). Cuenta desconocida → `svcOk`.
- `payout.failed` y `payout.canceled` → localizar por `stripePayoutId` persistido y
  transicionar condicionalmente `PROCESSING|APPROVED` a `FAILED|CANCELED`. Estos estados
  dejan de reservar saldo según XC-03. No confiar en metadata para tenant ni conservar
  `APPROVED` para un payout fallido.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; `unknown` + narrowing para metadata.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Verificación de firma sobre raw body (`req.text()`); firma inválida → 400.
- [ ] Todos los handlers requeridos por la política adoptada son idempotentes (escrituras
      absolutas o condicionales).
- [ ] El tenant siempre se resuelve desde BD, nunca se confía en metadata para autorizar.
- [ ] Session `completed` sin `payment_status: paid` no crea Payment ni marca `paidAt`.
- [ ] Session pagada de un Payment Link válido marca `paidAt`, cambia el link a `INACTIVE`
      y verifica `session.payment_link` contra `stripePaymentLinkId`.
- [ ] `payout.failed`/`payout.canceled` reconcilian el retiro por `stripePayoutId`.
- [ ] Refund parcial se reconcilia como unidad monetaria (Refund, Transfer, Payment y bono),
      no como un cambio aislado de status.
- [ ] Dispatcher extensible consumido después por F4-05 sin modificar `route.ts`.

## Comandos para Roger (si aplica)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
