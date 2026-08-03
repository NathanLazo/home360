# [F4-03] Servicio de Billing: customer de Stripe y alta de la suscripción

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §1, §2 (ciclo de suscripción); `spec/05-admin.md` §2 (`approveBusiness`)
- **Depende de**: `F4-01` (`Business.stripeCustomerId`, `Plan.stripePriceId`), `F3-02` (`ServiceResult`)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Al aprobar un negocio (F5-05) se crea la `Subscription` **local** dentro de una transacción
Prisma y, ya fuera del commit, se da de alta la suscripción en Stripe Billing. Este ticket
provee ese servicio, idempotente y reejecutable, para que F5 solo lo invoque.

**Problemas detectados en la spec, resueltos aquí:**

1. **No existe recolección de método de pago en ninguna spec** (no hay Stripe Elements ni
   Customer Portal; el negocio jamás captura tarjeta). Una suscripción automática sin
   payment method no cobra. `PENDIENTES.md` #4 mantiene abiertas tres políticas:
   Customer Portal, Elements o cobro manual `send_invoice`. **Este ticket no adopta el
   paliativo `send_invoice` ni ninguna alternativa.** Se pueden implementar el customer,
   el mapeo de estados y la estructura del servicio, pero el paso de creación de la
   suscripción queda bloqueado hasta que Roger registre la decisión.
2. F5-05 crea la suscripción local y llama a Stripe **best-effort**: si Stripe falla, el
   negocio queda ACTIVE con `stripeSubscriptionId = null`. **Resolución**: el servicio es
   de tipo `ensure*` (reparador): F5 puede reintentarlo y F4-04 puede invocarlo antes de
   una operación Stripe, sin duplicar nada. Las lecturas de F4-06 **no** tienen efectos.
3. La spec no define el mapeo `Stripe.Subscription.Status` → `SubscriptionStatus` local
   (3 valores). **Resolución**: tabla explícita en `subscription-status.ts`, reusada por los
   webhooks de F4-05.
4. El modelo no puede representar cancelación programada (`cancelAtPeriodEnd`,
   `canceledAt`) y `renewsAt` nace provisional en F5-05 (findings #20). No se agregan
   campos mientras el lifecycle de cancelación siga abierto; la UI no debe afirmar una
   fecha de término programado que no puede persistirse.

## Alcance

Crear:

- `src/server/services/subscription/subscription-status.ts`
- `src/server/services/subscription/billing.ts`

Fuera de alcance: cambio de plan (F4-04), webhooks (F4-05), UI. Cancelación/reactivación
y método de pago son bloqueos de negocio de este mismo flujo, no trabajo que el agente
pueda resolver por inferencia.

## Detalle técnico

`subscription-status.ts`:

```ts
import type Stripe from "stripe";
import type { SubscriptionStatus } from "generated/prisma";

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus;
// active | trialing                                   → "ACTIVE"
// past_due | unpaid | incomplete                      → "PAST_DUE"
// canceled | incomplete_expired | paused              → "CANCELED"
// switch exhaustivo (sin default): si Stripe agrega un estado, deja de compilar.

export function getRenewsAt(subscription: Stripe.Subscription): Date;
// fin del periodo vigente en epoch segundos → Date. El campo cambió de ubicación entre
// versiones del SDK (`current_period_end` en la suscripción vs. en el item): leerlo desde
// los tipos del SDK instalado, con narrowing, sin casts ni `any`.
```

`billing.ts` — todo por inyección (`type Deps = { db: PrismaClient; stripe: Stripe }`):

```ts
ensureStripeCustomer(deps, input: { businessId: string }):
  Promise<ServiceResult<{ stripeCustomerId: string }, "NOT_FOUND">>
```

1. `db.business.findUnique({ where: { id }, select: { id, name, stripeCustomerId, owner: { select: { email: true } } } })`; sin negocio → `NOT_FOUND`.
2. `stripeCustomerId` presente → `svcOk` sin llamar a Stripe (idempotente).
3. `stripe.customers.create({ name, email: owner.email ?? undefined, metadata: { businessId } }, { idempotencyKey: \`billing-customer-${businessId}\` })`.
4. `db.business.updateMany({ where: { id, stripeCustomerId: null }, data: { stripeCustomerId } })` (condicional: una carrera no pisa el id ajeno; si `count === 0`, releer y devolver el persistido).

```ts
ensureBillingSubscription(deps, input: { businessId: string }):
  Promise<ServiceResult<
    { stripeSubscriptionId: string; renewsAt: Date; created: boolean },
    "NO_SUBSCRIPTION" | "PLAN_NOT_SYNCED" | "NOT_FOUND"
  >>
```

### Puerta de decisión obligatoria

Antes de implementar o invocar `stripe.subscriptions.create`, buscar una decisión explícita
de Roger que fije, como mínimo: mecanismo de captura (Portal o Elements) **o**
`send_invoice`; `collection_method`; momento de creación respecto al método de pago;
cancelación/reactivación; y comportamiento ante fallo del primer cobro. Si falta cualquiera,
el agente debe detener esa parte, dejar el servicio sin llamadas de alta y reportar
`BLOCKED_BUSINESS_DECISION`; no debe elegir defaults de Stripe.

1. Cargar `Subscription` por `businessId` con `select: { id, status, stripeSubscriptionId, renewsAt, plan: { select: { code, stripePriceId } } }`.
   Sin fila → `NO_SUBSCRIPTION` (la crea `approveBusiness`, F5-05; este servicio nunca la inventa).
2. `stripeSubscriptionId` presente → `svcOk({ …, created: false })` sin llamar a Stripe.
3. `plan.stripePriceId === null` → `PLAN_NOT_SYNCED` (Roger no corrió `sync-stripe-plans`, F4-01).
4. `ensureStripeCustomer` → propagar fallo.
5. Crear la suscripción **solo** con los parámetros de cobro aprobados y documentados.
   Son invariantes comunes: `customer`, un solo `items: [{ price }]`,
   `metadata: { businessId, subscriptionId, planCode }` e idempotency key
   `billing-subscription-${subscriptionId}`. `collection_method`, `payment_behavior`,
   `days_until_due`, método por defecto y cualquier SetupIntent/Portal/Elements dependen
   de la decisión; no se rellenan por intuición.
   La `idempotencyKey` deriva del id local: un retry tras crash devuelve la **misma**
   suscripción de Stripe en vez de crear una segunda.
6. `db.subscription.updateMany({ where: { id, stripeSubscriptionId: null }, data: { stripeSubscriptionId: sub.id, status: mapStripeSubscriptionStatus(sub.status), renewsAt: getRenewsAt(sub) } })`.
7. Errores de Stripe: `instanceof Stripe.errors.StripeError` → `svcFail("STRIPE_ERROR")`;
   jamás re-lanzar hacia la procedure.

- Un solo item por suscripción es **invariante** del producto (un plan = un price); F4-04 lo
  asume al actualizar.
- Este servicio **no** crea `Invoice` locales: las crean los webhooks de factura (F4-05).

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
- [ ] `ensureStripeCustomer` es idempotente; `ensureBillingSubscription` solo se habilita
      cuando la política de cobro está decidida y entonces también es idempotente.
- [ ] `PLAN_NOT_SYNCED` se detecta **antes** de tocar Stripe.
- [ ] Firma estable para `F5-05 approveBusiness` (paso post-commit best-effort) y para F4-04.
- [ ] Ningún `default` en el `switch` del mapeo de estados (exhaustividad verificada por tsc).

## Comandos para Roger (si aplica)

```bash
pnpm tsx scripts/sync-stripe-plans.ts
```

Bloqueado además por la decisión fiscal de F4-01 antes de publicar/cobrar Prices.
