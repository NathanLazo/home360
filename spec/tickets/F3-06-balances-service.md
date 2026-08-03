# [F3-06] Servicio `getBusinessBalances`: saldos siempre derivados

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1 (saldos derivados), §2 (`payments/balances.ts`), §4
- **Depende de**: `F3-01`, `XC-25`
- **Tamaño estimado**: S

## Contexto

Los saldos jamás se persisten: se derivan en cada lectura. `escrowCents`,
`escrowOrdersCount` y `loyaltyPendingCents` son resolubles. `availableCents` y la comisión
mensual tras refund parcial están **bloqueados** por `PENDIENTES.md` decisiones 1 y 2.
La versión anterior declaraba canónica una fórmula provisional; se elimina para no decidir
por Roger. La separación entre total, tarifa y principal ya viene de `XC-25`; `XC-03`,
`XC-08` y `XC-27` cierran después los estados elegibles sin bloquear las lecturas no
controvertidas. F3-07 no puede implementarse hasta cerrar esas fórmulas.

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

- `availableCents`: **no implementar hasta resolver PENDIENTES #1–#3**. Después debe usar
  `providerTransferCents` de `XC-25` y la proyección de `XC-27`. La fórmula debe
  especificar literalmente qué estados aportan, si el monto es bruto o neto, cómo entra
  `PARTIALLY_REFUNDED`, qué comisión final se resta y qué estados de retiro reservan/sacan
  saldo. No clampear negativos: son una inconsistencia que debe aflorar.
- `escrowCents` = Σ `amountCents` de pagos `IN_ESCROW` (bruto, como muestra el diseño);
  `escrowOrdersCount` = count de esos pagos.
- `monthCommissionCents`: `REFUNDED` total aporta cero; el tratamiento de
  `PARTIALLY_REFUNDED` usa exactamente la decisión 1. Definir también el huso horario del
  mes calendario; hasta entonces no asumir UTC ni zona local del servidor.
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
- [ ] Decisiones 1–3 de `PENDIENTES.md` están reflejadas literalmente en las fórmulas antes
      de implementar `availableCents`.
- [ ] Revisión manual con fixtures cubre cada estado de Payment/Withdrawal, límites del mes
      y `PARTIALLY_REFUNDED`; no se agregan tests automatizados.

## Comandos para Roger (si aplica)

—
