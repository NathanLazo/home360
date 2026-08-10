# [F3-07] Servicio de retiros según el contrato aprobado de Connect

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §2 (`payments/withdrawals.ts`); `spec/05-admin.md` §4 (`admin.finance` los consume)
- **Depende de**: `F3-02`, `F3-06`, `XC-08` y decisión 3 de `PENDIENTES.md` (resuelta)
- **Estado**: **DESBLOQUEADO** — Payout manual con aprobación.
- **Tamaño estimado**: M

## Contexto

Ciclo aprobado: el negocio solicita y el admin aprueba o rechaza. Aprobar crea un Stripe
`Payout` en la cuenta Connect; nunca crea otro `Transfer`. El id externo se persiste como
`stripePayoutId` y la operación usa la máquina de estados de XC-08.
Problemas técnicos ya identificados:

1. El dinero ya está en Connect y aprobar crea un `Payout`; `XC-08` renombra
   `Withdrawal.stripeTransferId` a `stripePayoutId`. No guardar un payout bajo un nombre de
   transfer.
2. **Carrera en la solicitud**: dos requests simultáneos podrían pasar ambos la validación de
   saldo. Resolución: validación + creación dentro de una transacción interactiva con
   `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`.
3. Si el admin **rechaza**, no hay monto que devolver: el saldo es derivado y los retiros
   `REJECTED` no restan (F3-06); basta el cambio de estado.

## Alcance

- Crear/ajustar: `src/server/services/payments/withdrawals.ts` y, solo para la rama aprobada,
  los fixtures de `Withdrawal` en `prisma/seed/payments.ts` que F0-14 dejó fuera.
- Fuera de alcance: router business (F3-11) y router `admin.finance` (F5).

## Detalle técnico

```ts
requestWithdrawal(deps: { db }, input: {
  businessId: string; amountCents: number; bankName: string; accountLast4: string;
}): Promise<ServiceResult<{ withdrawalId: string }, "INSUFFICIENT_BALANCE">>
// - amountCents > 0 (Zod ya lo garantiza en el router; el servicio re-valida).
// - accountLast4: exactamente 4 dígitos; JAMÁS se recibe/persiste la cuenta completa.
// - db.$transaction(async (tx) => { balance = getBusinessBalances({ db: tx }, …);
//     if (amountCents > availableCents) → INSUFFICIENT_BALANCE;
//     tx.withdrawal.create({ status: REQUESTED, … }) }, { isolationLevel: "Serializable" })
//   Reintento único ante error de serialización de Postgres (P2034).

// Esta firma existe únicamente en la rama manual de XC-08.
approveWithdrawal(deps: { db; stripe }, input: { withdrawalId: string }):
  Promise<ServiceResult<
    { withdrawalId: string; stripePayoutId: string },
    "WITHDRAWAL_NOT_PENDING" | "NO_CONNECT_ACCOUNT" | "BUSINESS_SUSPENDED"
  >>
// 1. Cargar withdrawal + business { stripeAccountId, payoutsEnabled, status }.
// 2. Validar los guards mutables solo en REQUESTED y reclamar atómicamente
//    REQUESTED → PROCESSING antes de llamar Stripe, congelando al mismo tiempo
//    payoutStripeAccountId = business.stripeAccountId.
//    Un retry puede continuar PROCESSING con la misma idempotency key; reject solo acepta
//    REQUESTED. Esto evita la carrera "admin rechaza mientras otro proceso crea el Payout".
//    business.status === SUSPENDED → BUSINESS_SUSPENDED (F5 lo mapea a CONFLICT).
//    Sin cuenta o payoutsEnabled false → NO_CONNECT_ACCOUNT.
//    PROCESSING nunca reevalúa status/payoutsEnabled/stripeAccountId del negocio: usa
//    exclusivamente payoutStripeAccountId para recuperar el mismo intento remoto.
// 3. Crear el Payout manual aprobado:
//    stripe.payouts.create({ amount: amountCents, currency: "mxn",
//      metadata: { withdrawalId } },
//      { stripeAccount: business.stripeAccountId,
//        idempotencyKey: `payout-withdrawal-${withdrawalId}` })
//    Payout ANTES de escribir BD (mismo patrón crash-safe que F3-04).
// 4. Tras crear el Payout, PROCESSING → APPROVED, guardar stripePayoutId y resolvedAt.
//    Fallo síncrono antes de obtener un Payout deja PROCESSING reintentable con la misma key.
//    payout.failed/canceled reconcilia PROCESSING|APPROVED → FAILED|CANCELED.
//    Si una carrera ya dejó APPROVED + stripePayoutId, retornar ese éxito convergente.

rejectWithdrawal(deps: { db }, input: { withdrawalId: string; reason: string }):
  Promise<ServiceResult<{ withdrawalId: string }, "WITHDRAWAL_NOT_PENDING">>
// updateMany condicional REQUESTED → { status: REJECTED, rejectionReason, resolvedAt }.
```

- F3-09 maneja `payout.failed` y `payout.canceled` con escritura absoluta/condicional por
  `stripePayoutId`. `FAILED|CANCELED` dejan de reservar saldo; un evento duplicado converge.
- `getBusinessBalances` reserva `REQUESTED|PROCESSING|APPROVED` y libera
  `REJECTED|FAILED|CANCELED`.

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
- [ ] Solicitud a prueba de carreras (transacción Serializable + revalidación server-side).
- [ ] La decisión 3 de `PENDIENTES.md` está registrada y el servicio implementa Payout
      manual, sin mezclar Transfer y Payout.
- [ ] Si el flujo es manual, aprobación y eventos failed/canceled son idempotentes y
      restauran correctamente el saldo derivado.
- [ ] Aprobar y rechazar concurrentemente no puede producir un Payout asociado a un retiro
      `REJECTED`; existe recuperación documentada de `PROCESSING`.
- [ ] `PROCESSING` usa el snapshot `payoutStripeAccountId`; cambios posteriores del negocio
      no alteran la cuenta Stripe ni bloquean la reconciliación.
- [ ] Firma de `approveWithdrawal` estable para F5 (`admin.finance.approveWithdrawal`).
- [ ] Solo banco + últimos 4 dígitos en BD.
- [ ] Banco/últimos 4 se presentan como confirmación; Stripe usa la cuenta bancaria por
      defecto verificada de Connect y la UI no afirma que esos campos enrutan el Payout.

## Comandos para Roger (si aplica)

La migración de `payoutStripeAccountId` es manual. Debe agregarse nullable. Para filas
`REQUESTED` y terminales queda null. Cada fila `PROCESSING` existente requiere revisión:
backfill desde `Business.stripeAccountId` únicamente si se verificó que la cuenta no cambió
desde el claim; si pudo rotar o ya existe un Payout remoto, reconciliar primero contra Stripe
usando `withdrawalId`/idempotency key. No asignar una cuenta actual sin esa verificación.
