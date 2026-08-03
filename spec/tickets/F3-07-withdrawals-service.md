# [F3-07] Servicio de retiros según el contrato aprobado de Connect

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §2 (`payments/withdrawals.ts`); `spec/05-admin.md` §4 (`admin.finance` los consume)
- **Depende de**: `F3-02`, `F3-06`, `XC-08` y decisión 3 de `PENDIENTES.md`
- **Tamaño estimado**: M

## Contexto

Ciclo mostrado por el diseño: `REQUESTED` → admin aprueba o rechaza. La operación Stripe
real está **bloqueada** por `PENDIENTES.md` decisión 3: payouts automáticos vs. manuales y,
si son manuales, confirmación de `Payout` desde la cuenta Connect. No implementar este
ticket ni conservar el nombre heredado del id externo hasta que Roger decida.
Problemas técnicos ya identificados:

1. La spec mezcla `Transfer`/`Payout`. Si Roger adopta el modelo manual descrito en
   PENDIENTES, el dinero ya está en Connect y aprobar crea un `Payout`; `XC-08` ya habrá
   renombrado `Withdrawal.stripeTransferId` a `stripePayoutId` y fijado los estados. No
   guardar un payout bajo un nombre de transfer por omisión.
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
// 2. En flujo manual, reclamar atómicamente REQUESTED → PROCESSING antes de llamar Stripe.
//    Un retry puede continuar PROCESSING con la misma idempotency key; reject solo acepta
//    REQUESTED. Esto evita la carrera "admin rechaza mientras otro proceso crea el Payout".
//    business.status === SUSPENDED → BUSINESS_SUSPENDED (F5 lo mapea a CONFLICT).
//    Sin cuenta o payoutsEnabled false → NO_CONNECT_ACCOUNT.
// 3. SOLO si PENDIENTES #3 adopta payout manual:
//    stripe.payouts.create({ amount: amountCents, currency: "mxn",
//      metadata: { withdrawalId } },
//      { stripeAccount: business.stripeAccountId,
//        idempotencyKey: `payout-withdrawal-${withdrawalId}` })
//    Payout ANTES de escribir BD (mismo patrón crash-safe que F3-04).
// 4. Tras crear el Payout, PROCESSING → APPROVED y guardar el id externo. Definir qué
//    ocurre con fallo síncrono y con payout.failed/canceled; nunca dejar PROCESSING eterno.

rejectWithdrawal(deps: { db }, input: { withdrawalId: string; reason: string }):
  Promise<ServiceResult<{ withdrawalId: string }, "WITHDRAWAL_NOT_PENDING">>
// updateMany condicional REQUESTED → { status: REJECTED, rejectionReason, resolvedAt }.
```

- Si la decisión es manual, F3-09 debe manejar al menos `payout.failed` y
  `payout.canceled` para que un retiro no quede `APPROVED` mientras el dinero vuelve al
  saldo de Connect. Si los enums actuales no expresan ese estado, el cambio de schema forma
  parte de `XC-08` y la migración la ejecuta Roger.
- Si la decisión es payouts automáticos, no implementar `requestWithdrawal` ni
  `approveWithdrawal`: exponer historial sincronizado según `XC-08`, retirar/ocultar esas
  procedures en F3-11/F5-11/F5-12 y sembrar solo fixtures compatibles con esa fuente.

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
- [ ] La decisión 3 de `PENDIENTES.md` está registrada y el servicio implementa exactamente
      ese flujo, sin mezclar Transfer y Payout.
- [ ] Si el flujo es manual, aprobación y eventos failed/canceled son idempotentes y
      restauran correctamente el saldo derivado.
- [ ] Aprobar y rechazar concurrentemente no puede producir un Payout asociado a un retiro
      `REJECTED`; existe recuperación documentada de `PROCESSING`.
- [ ] Firma de `approveWithdrawal` estable para F5 (`admin.finance.approveWithdrawal`).
- [ ] Solo banco + últimos 4 dígitos en BD.
- [ ] Banco/últimos 4 se presentan como confirmación; Stripe usa la cuenta bancaria por
      defecto verificada de Connect y la UI no afirma que esos campos enrutan el Payout.

## Comandos para Roger (si aplica)

—
