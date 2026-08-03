# [F5-11] Implementar aprobación y rechazo de retiros (`approveWithdrawal` / `rejectWithdrawal`)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §4, `spec/03-payments.md` §1–2 (`payments/withdrawals.ts`)
- **Depende de**: `F5-10`, `F3-07`, `XC-08` y decisión 3 de `PENDIENTES.md`
- **Tamaño estimado**: M (1–3 h)
- **Estado**: **BLOQUEADO** por `PENDIENTES.md` §3. No implementar
  `approveWithdrawal` hasta que Roger decida el modelo de retiro.

## Contexto

Mutations admin sobre `Withdrawal`: aprobar dispara el movimiento real vía el servicio
`approveWithdrawal` de F3 (mecanismo pendiente de decisión); rechazar libera
el monto de vuelta al disponible (automático: el saldo disponible de F3 solo descuenta
`REQUESTED|APPROVED`, un `REJECTED` deja de restar).

**Problemas detectados y resolución**:

1. La spec F5 dice "(Transfer/Payout)" y `PENDIENTES.md` §3 confirma que siguen abiertas
   dos decisiones acopladas: Transfer vs. Payout y payouts automáticos vs. manuales.
   Este ticket **no ratifica** el Payout/manual descrito hoy en F3-07 ni el campo
   `stripeTransferId`. Antes de implementar, Roger debe elegir; después se alinea F5 con
   el contrato único de F3 y, si corresponde, se renombra el campo al objeto Stripe real.
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
// 3. BLOQUEADO: aplicar exactamente el mecanismo que Roger cierre en F3.
//    Invariantes para cualquiera de las opciones:
//    - llamada Stripe fuera de la transacción Prisma;
//    - idempotency key determinística derivada de withdrawalId;
//    - updateMany condicional REQUESTED al persistir APPROVED;
//    - retry tras crash converge sin duplicar dinero;
//    - persistir el id en un campo cuyo nombre corresponda al objeto Stripe.
// Result: TrpcResponse<{ id }>

// rejectWithdrawal — input { withdrawalId: cuid, reason: string.trim().min(5).max(500) }
// updateMany { id, status: REQUESTED } →
//   { status: REJECTED, rejectionReason: reason, resolvedAt: now }; count 0 → CONFLICT.
// Sin Stripe. El disponible del negocio se recupera solo (fórmula de balances F3).
```

Si Roger elige payouts automáticos, este ticket no crea mutations de aprobación/rechazo:
retira esa superficie de `admin.finance`, y F5-12 presenta únicamente historial sincronizado.

- Ambas mutations son wrappers delgados `adminProcedure.mutation` sobre los servicios.
- Verificación manual una vez resuelto el bloqueo: aprobar REQUESTED mueve el monto exacto
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
- [ ] Tras la decisión de Roger, la aceptación nombra y verifica el objeto Stripe elegido;
      no conserva el texto ambiguo "Transfer/Payout".
- [ ] Aprobar el retiro del negocio suspendido → `CONFLICT` (la UI de F5-12 ni lo permite,
      pero el server lo bloquea igual).
- [ ] Rechazar un retiro REQUESTED lo marca REJECTED con razón y el disponible del negocio
      vuelve a reflejar el monto (visible en W6).

## Comandos para Roger (si aplica)

Bloqueado hasta la decisión de `PENDIENTES.md` §3. No verificar movimientos monetarios
contra filas seed sin un objeto Stripe real.
