# [F3-06] Servicio `getBusinessBalances`: saldos siempre derivados

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1 (saldos derivados), §2 (`payments/balances.ts`), §4
- **Depende de**: `F3-01`, `XC-25`
- **Tamaño estimado**: S

## Contexto

Los saldos jamás se persisten: se derivan en cada lectura. Roger aprobó la fórmula neta de
XC-03, comisión proporcional y payouts manuales, así que `availableCents` y la comisión
mensual están **DESBLOQUEADOS**. La separación entre total, tarifa y principal viene de
`XC-25`; los estados de retiro vienen de `XC-08`.

## Alcance

- Crear: `src/server/services/payments/balances.ts`
- Fuera de alcance: procedure `getBalances` (F3-11), KPIs de admin (F5).

## Detalle técnico

```ts
getBusinessBalances(deps: { db }, input: { businessId: string; now?: Date }):
  Promise<ServiceResult<{
    availableCents: number;
    escrowCents: number;            // bruto: lo que pagó el cliente y está retenido
    escrowOrdersCount: number;
    monthCommissionCents: number;
    loyaltyPendingCents: number;    // bonos devengados y aún no liquidados (D3)
  }>>
```

Todas las agregaciones filtran por `payment.businessId` — denormalizado en F3-01 — y no
traen filas completas:

- `availableCents` usa literalmente:

  ```text
  retainedProviderCents(p) = p.providerAmountCents - p.providerRefundedCents
  providerNetCents(p) = retainedProviderCents(p) - p.commissionCents

  availableCents = Σ providerNetCents(p)
    para p.status ∈ {RELEASED, PARTIALLY_REFUNDED}
    - Σ w.amountCents
    para w.status ∈ {REQUESTED, PROCESSING, APPROVED}
  ```

  `commissionCents` ya es la comisión proporcional efectivamente retenida. Retiros
  `REJECTED|FAILED|CANCELED` no reservan saldo. No clampear negativos: son una
  inconsistencia que debe aflorar.
- `escrowCents` = Σ `amountCents` de pagos `IN_ESCROW` (bruto, como muestra el diseño);
  `escrowOrdersCount` = count de esos pagos.
- `monthCommissionCents`: `REFUNDED` total aporta cero y `PARTIALLY_REFUNDED` aporta su
  `commissionCents` proporcional final. El huso horario del mes debe venir explícito del
  caller/configuración; no asumir UTC ni zona local del servidor.
- `loyaltyPendingCents` = Σ `amountCents` de `LoyaltyBonus` del negocio con status
  `PENDING` (D3). Es un **cuarto saldo independiente**: no se suma al disponible ni al
  escrow, porque no se retira por el flujo de `Withdrawal` — lo liquida el admin en vales o
  transferencia (F5-16). La app móvil lo muestra así, como tercera tarjeta de la wallet
  junto a disponible y escrow.

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
- [ ] Ninguna columna de saldo persistida; todo derivado por agregación.
- [ ] Decisiones 1–3 de `PENDIENTES.md` están reflejadas literalmente en las fórmulas de
      `availableCents` y comisión mensual.
- [ ] Revisión manual con fixtures cubre cada estado de Payment/Withdrawal, límites del mes
      y `PARTIALLY_REFUNDED`; no se agregan tests automatizados.

## Comandos para Roger (si aplica)

—
