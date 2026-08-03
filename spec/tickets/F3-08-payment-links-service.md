# [F3-08] Definir e implementar links de cobro persistentes

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §2 (`payments/payment-links.ts`), §5
- **Depende de**: `F3-01`, `XC-25`
- **Tamaño estimado**: M
- **Estado**: **DESBLOQUEADO**. Roger eligió Stripe Payment Links API persistente y de un
  solo uso lógico.

## Contexto

El negocio genera un link (concepto + monto) que el cliente paga; el cargo entra a la
plataforma y sigue el flujo de escrow normal. El contrato cerrado usa Stripe Payment Links
API, no una Checkout Session creada directamente. Cada link remoto limita sus sesiones
completadas a una y la fila local conserva su ciclo de vida explícito
`CREATING | ACTIVE | INACTIVE`.

Aunque Stripe genera una Checkout Session al abrir el link, la metadata debe viajar también
en `payment_intent_data.metadata`: la metadata de la Session no se propaga automáticamente al
PaymentIntent. `XC-25` resuelve el monto: el negocio introduce `providerAmountCents`; el
servidor lee `customerServiceFeeCents`, calcula el total y persiste ambos datos para que F3-03
los valide y congele. La UI nunca envía un total ambiguo.

## Alcance

- Crear: `src/server/services/payments/payment-links.ts`
- Fuera de alcance: procedure `createPaymentLink` (F3-11), handler
  `checkout.session.completed` (F3-09).

## Detalle técnico

```ts
createPaymentLink(deps: { db; stripe }, input: {
  businessId: string; concept: string; providerAmountCents: number; locale: "es" | "en";
  baseUrl: string;
}): Promise<ServiceResult<{ paymentLinkId: string; url: string }>>
```

Pasos:

1. Leer la tarifa en servidor y crear la fila local primero:
   `db.paymentLink.create({ businessId, concept, amountCents: providerAmountCents,
   status: CREATING, stripeUrl: null })`. Su `id` viaja en metadata.
2. Crear o reutilizar el Price requerido por Payment Links API por el total
   `providerAmountCents + serviceFeeCentsApplied`, con moneda `mxn` y nombre `concept`.
3. Crear el Payment Link remoto con:
   - `line_items: [{ price: price.id, quantity: 1 }]`;
   - `restrictions.completed_sessions.limit: 1`;
   - `metadata` y `payment_intent_data.metadata` con
     `{ paymentLinkId, businessId, providerAmountCents, serviceFeeCentsApplied }`;
   - redirección posterior al pago a `${baseUrl}/${locale}/pay/success`.
4. Persistir atómicamente lo local disponible:
   `stripePaymentLinkId`, `stripeUrl` y `status: ACTIVE`.

La creación remota usa claves de idempotencia determinísticas derivadas del id local, con
sufijos por recurso (por ejemplo, `payment-link-${paymentLinkId}-price` y
`payment-link-${paymentLinkId}`). Si Stripe falla después del paso 1, la fila permanece
`CREATING`, sin URL compartible. Un retry/reconciliador reutiliza las mismas claves y converge
al mismo Price/Payment Link; nunca crea otra fila ni publica `stripeUrl: null`.

Al confirmarse el pago, F3-09 escribe `paidAt` y `status: INACTIVE`. `paidAt` es un hecho de
pago, no un estado remoto: no existen estados locales `PAID` ni `FAILED` para PaymentLink.
El límite remoto de una sesión completada evita cobros repetidos incluso antes de que llegue
el webhook que desactiva localmente el link.

- Solo el principal es input validado (`providerAmountCents` Int positivo); tarifa y total
  se calculan server-side y F3-03 los reconcilia con `amount_received`.
- Las páginas públicas mínimas quedan fuera de este ticket (F3-13 agrega placeholders).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre
  Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Se usa Payment Links API; no se crea una Checkout Session directamente.
- [ ] Metadata presente en el Payment Link y en el PaymentIntent resultante.
- [ ] `restrictions.completed_sessions.limit` es `1`.
- [ ] Solo `ACTIVE` con URL no nula se presenta como cobrable.
- [ ] Creación remota idempotente y estado `CREATING` reconciliable ante fallos Stripe/BD.

## Comandos para Roger (si aplica)

—
