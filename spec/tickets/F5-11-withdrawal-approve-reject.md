# [F5-11] Implementar aprobación y rechazo de retiros (`approveWithdrawal` / `rejectWithdrawal`)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §4, `spec/03-payments.md` §1–2 (`payments/withdrawals.ts`)
- **Depende de**: `F5-10`, `F3-07`, `XC-08`
- **Tamaño estimado**: M (1–3 h)
- **Estado**: **DESBLOQUEADO**. Roger eligió retiros manuales aprobados por admin mediante
  Stripe Payout.

## Contexto

Mutations admin sobre `Withdrawal`: aprobar dispara el movimiento real vía el servicio
`approveWithdrawal` de F3 mediante Stripe Payout; rechazar libera
el monto de vuelta al disponible (automático: el saldo disponible de F3 solo descuenta
`REQUESTED|PROCESSING|APPROVED`, un `REJECTED` deja de restar).

**Problemas detectados y resolución**:

1. El contrato único es Payout manual. El identificador externo se persiste en
   `stripePayoutId`; no se usa Transfer ni el nombre heredado `stripeTransferId`.
2. Negocio sin `stripeAccountId` o sin payouts habilitados: la spec no lo cubre.
   **Resolución**: → `CONFLICT` (el admin ve "el negocio no ha completado su cuenta de
   pagos"); no se intenta ningún movimiento.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/finance.ts` — mutations `approveWithdrawal`,
  `rejectWithdrawal` (delegan en servicios F3).
- `src/server/services/payments/withdrawals.ts` — consumir, no redefinir, el contrato que
  F3-07 materializó desde `XC-08`; ajustar solo los guards admin si faltan.
- `finance.schema.ts` — inputs y códigos de error del módulo (creado en F5-10).

Fuera de alcance: UI de W12 (F5-12), solicitud de retiro (F3).

## Detalle técnico

```ts
// approveWithdrawal — input { withdrawalId: z.string().cuid() }
// Servicio approveWithdrawal({ db, stripe }, { withdrawalId }):
// 1. Cargar withdrawal + business { id, status, stripeAccountId, payoutsEnabled } →
//    no existe: NOT_FOUND.
// 2. Guards: business.status === SUSPENDED → CONFLICT ("Cuenta suspendida", diseño W12);
//    !business.stripeAccountId || !business.payoutsEnabled → CONFLICT.
// 3. Reservar con updateMany REQUESTED → PROCESSING antes de la llamada remota.
// 4. Crear stripe.payouts.create por amount/currency de la fila y con idempotency key
//    `payout-withdrawal-${withdrawalId}`; llamada Stripe fuera de transacción Prisma.
// 5. Persistir stripePayoutId, PROCESSING → APPROVED y resolvedAt.
//    Retry tras crash reutiliza la clave, recupera el mismo Payout y converge sin duplicar.
// Result: TrpcResponse<{ id }>

// rejectWithdrawal — input { withdrawalId: cuid, reason: string.trim().min(5).max(500) }
// updateMany { id, status: REQUESTED } →
//   { status: REJECTED, rejectionReason: reason, resolvedAt: now }; count 0 → CONFLICT.
// Sin Stripe. El disponible del negocio se recupera solo (fórmula de balances F3).
```

- Ambas mutations son wrappers delgados `adminProcedure.mutation` sobre los servicios.
- Verificación manual: aprobar REQUESTED mueve el monto exacto
  una sola vez y persiste id + `resolvedAt`; doble approve → `CONFLICT`; suspendido o sin
  onboarding completo → `CONFLICT`; fallo externo queda reintentable; reject persiste
  razón y no llama Stripe.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse`; códigos estables (`CONFLICT`, `NOT_FOUND`, `STRIPE_ERROR`).
- `adminProcedure`; 403 uniforme.
- Llamadas Stripe fuera de transacciones Prisma; gate `updateMany` por estado e
  idempotency key derivada del `withdrawalId`.
- `stripe`/`db` inyectados por parámetro; sin `any`.
- Datos bancarios: nunca más que banco + últimos 4.
- Identificadores en inglés.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- [ ] La aprobación crea exactamente un Stripe Payout y persiste su id en
      `stripePayoutId`; no conserva el texto ambiguo "Transfer/Payout".
- [ ] Aprobar el retiro del negocio suspendido → `CONFLICT` (la UI de F5-12 ni lo permite,
      pero el server lo bloquea igual).
- [ ] Rechazar un retiro REQUESTED lo marca REJECTED con razón y el disponible del negocio
      vuelve a reflejar el monto (visible en W6).

## Comandos para Roger (si aplica)

No verificar movimientos monetarios contra filas seed sin un objeto Stripe real.
