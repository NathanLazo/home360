# [F3-02] Servicio Stripe Connect: cuenta Express, onboarding y estado

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §2 (`stripe/connect.ts`), §3
- **Depende de**: `F3-01`, `XC-08`
- **Tamaño estimado**: M

## Contexto

Los negocios reciben su dinero en una cuenta Stripe Connect **Express** (MX). La creación de
la cuenta y el onboarding usan el contrato cerrado de XC-08: calendario de payouts manual y
retiros aprobados por admin que crean un Stripe Payout.
Este ticket también introduce el tipo `ServiceResult`, la convención de retorno de todos
los servicios de dominio de F3/F4.

## Alcance

- Crear: `src/server/services/service-result.ts`
- Crear: `src/server/services/stripe/connect.ts`
- Fuera de alcance: router tRPC (F3-11), webhook `account.updated` (F3-09).

## Detalle técnico

`service-result.ts`:

```ts
export type ServiceResult<TData, TError extends string = never> =
  | { ok: true; data: TData }
  | { ok: false; code: TError | "STRIPE_ERROR" | "NOT_FOUND" | "CONFLICT"; detail?: string };

export const svcOk = <T>(data: T): ServiceResult<T, never> => ({ ok: true, data });
export const svcFail = /* helper tipado equivalente a fail */
```

`connect.ts` — todas las funciones reciben dependencias por parámetro (fakes en tests):

```ts
type Deps = { db: PrismaClient; stripe: Stripe };

createConnectAccount(deps, input: { businessId: string }):
  Promise<ServiceResult<{ stripeAccountId: string }>>
// - Si business.stripeAccountId ya existe → svcOk con el existente (idempotente).
// - stripe.accounts.create({ type: "express", country: "MX",
//     capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
//     metadata: { businessId } })
//   settings: { payouts: { schedule: { interval: "manual" } } }.
//   Crear con idempotencyKey determinística `connect-account-${businessId}`.
// - Persiste stripeAccountId en Business.

createOnboardingLink(deps, input: { businessId: string; returnUrl: string; refreshUrl: string }):
  Promise<ServiceResult<{ url: string }, "NO_CONNECT_ACCOUNT">>
// stripe.accountLinks.create({ account, type: "account_onboarding", return_url, refresh_url })

getAccountStatus(deps, input: { businessId: string }):
  Promise<ServiceResult<{ chargesEnabled: boolean; payoutsEnabled: boolean }, "NO_CONNECT_ACCOUNT">>
// stripe.accounts.retrieve → charges_enabled / payouts_enabled; sincroniza los flags
// Business.chargesEnabled / payoutsEnabled si difieren (misma lógica que usará el webhook).
```

- Errores de Stripe: capturar `unknown`, narrowing con `instanceof Stripe.errors.StripeError`
  → `svcFail("STRIPE_ERROR")`. Jamás re-lanzar con stack hacia la procedure.
- Si Stripe crea la cuenta y falla la persistencia local, el retry usa la misma
  `idempotencyKey`; no puede crear una segunda cuenta. La metadata sirve para soporte, no
  como autorización.
- `svcFail` debe conservar el genérico literal del código; no se permiten `string`, casts
  amplios ni tipos implícitos que degraden `TError`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] La decisión 3 de `PENDIENTES.md` está registrada antes de implementar y el calendario
      de payouts coincide literalmente con ella.
- [ ] Cuenta Express creada con `metadata.businessId` e idempotency key determinística.
- [ ] `createConnectAccount` es idempotente incluso si Stripe respondió y la BD falló.
- [ ] Ningún servicio importa el singleton de Stripe directamente: todo por parámetro.

## Comandos para Roger (si aplica)

—
