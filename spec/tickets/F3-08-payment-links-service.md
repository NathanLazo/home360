# [F3-08] Definir e implementar links de cobro persistentes

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §2 (`payments/payment-links.ts`), §5
- **Depende de**: `F3-01`, `XC-25`
- **Tamaño estimado**: M

## Contexto

El negocio genera un link (concepto + monto) que el cliente paga; el cargo entra a la
plataforma y sigue el flujo de escrow normal. Problema detectado: la spec pone la metadata
solo en la Checkout Session, pero la metadata de una Session **no se propaga** al
PaymentIntent; el handler de `payment_intent.succeeded` (F3-09) no podría identificar
link/negocio. Resolución: la metadata se fija **también** en `payment_intent_data.metadata`.
Las Checkout Sessions expiran (24 h máx.), mientras el caso de uso promete una URL
compartible. Findings #9 deja abierta la elección entre Stripe Payment Links API y Checkout
con expiración/regeneración visible. Este ticket no inventa la opción: antes de implementar,
Roger debe elegirla. Si elige Checkout, F3-01 agrega `expiresAt` y un estado regenerable; si
elige Payment Links API, se sustituyen los campos `stripeSessionId`/eventos correspondientes.
`XC-25` resuelve D2: el negocio introduce `providerAmountCents`; el servidor lee
`customerServiceFeeCents`, calcula el total de Checkout y escribe ambos en metadata para que
F3-03 los valide y congele. La UI nunca envía un total ambiguo.

## Alcance

- Crear: `src/server/services/payments/payment-links.ts`
- Fuera de alcance: procedure `createPaymentLink` (F3-11), handler
  `checkout.session.completed` (F3-09).

## Detalle técnico

```ts
createPaymentLink(deps: { db; stripe }, input: {
  businessId: string; concept: string; providerAmountCents: number; locale: "es" | "en";
  baseUrl: string;   // origen para success/cancel URLs, viene del router
}): Promise<ServiceResult<{ paymentLinkId: string; url: string }>>
```

Pasos:

1. Leer la tarifa en servidor y crear
   `db.paymentLink.create({ businessId, concept, amountCents: providerAmountCents,
   stripeUrl: "" })` — primero
   la fila para tener el `id` que viaja en metadata.
2. `stripe.checkout.sessions.create({
     mode: "payment",
     line_items: [{ quantity: 1, price_data: { currency: "mxn",
       unit_amount: providerAmountCents + serviceFeeCentsApplied,
       product_data: { name: concept } } }],
     metadata: { paymentLinkId, businessId, providerAmountCents, serviceFeeCentsApplied },
     payment_intent_data: { metadata: {
       paymentLinkId, businessId, providerAmountCents, serviceFeeCentsApplied
     } },
     success_url: `${baseUrl}/${locale}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${baseUrl}/${locale}/pay/cancelled`,
     locale,
   })`
3. `db.paymentLink.update({ stripeUrl: session.url, stripeSessionId: session.id })`.
4. Error de Stripe tras el paso 1 → dejar un estado local explícito no compartible y
   reintentable; no publicar `stripeUrl: ""` como válido. Una transacción Prisma no puede
   abarcar atómicamente una llamada remota. La estrategia de compensación/reconciliación
   debe quedar escrita según la API elegida y usar idempotency key
   `payment-link-${paymentLinkId}`.

- `success_url`/`cancel_url`: páginas públicas mínimas quedan **fuera** de este ticket
  (F3-13 agrega placeholders); las URLs se construyen igual.
- Solo el principal del link es input validado (`providerAmountCents` Int positivo); tarifa
  y total se calculan server-side y F3-03 los reconcilia con `amount_received`.

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
- [ ] Metadata `{ paymentLinkId, businessId }` presente en la Session **y** en el
      PaymentIntent resultante.
- [ ] La elección API persistente vs. Session expirable está escrita antes de implementar;
      una URL expirada nunca se presenta como cobrable y existe regeneración si aplica.
- [ ] Creación remota idempotente y estado local reconciliable ante fallos entre Stripe/BD.

## Comandos para Roger (si aplica)

—
