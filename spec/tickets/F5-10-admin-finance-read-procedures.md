# [F5-10] Implementar procedures de lectura de `admin.finance` (KPIs, retiros, breakdown)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §4, `spec/03-payments.md` §1 (saldos derivados), `spec/00-foundations.md` §3 (Payment, Withdrawal, Invoice, PlatformSettings)
- **Depende de**: `F5-01`, `F0-12` (`LoyaltyBonus`), `F3-04` (devengo)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Capa de datos de W12: KPIs financieros, listado de retiros y desglose de ingresos.

**Problemas detectados y resolución**:

1. D3/D5 ya resolvieron el origen de "Bonos de lealtad pagados": `F0-12` crea
   `LoyaltyBonus` y `F3-04` devenga uno por pago liberado. **Resolución**:
   `loyaltyBonusCents` suma exclusivamente bonos `PAID` por `paidAt` dentro del periodo.
   Está prohibido mostrar estimaciones por órdenes completadas como si fueran dinero real.
2. **Comisión del mes vs. reembolsos**: la spec F3 dice "Σ commissionCents de pagos del
   mes" sin excluir reembolsados, pero en un `FULL_REFUND` la plataforma no ganó comisión.
   **Resolución**: `commissionCents` de KPIs y breakdown excluye pagos `REFUNDED`
   y suma el `commissionCents` **persistido** en `PARTIALLY_REFUNDED`. Así la lectura no
   recalcula la política: F3 actualiza ese campo con la comisión proporcional efectiva.
3. Este ticket crea la lectura base. `XC-27` se ejecuta después y es la única unidad que
   añade tarifa de servicio neta, ingreso bruto/neto y nombres financieros conciliados con
   W3/W6/W9; no implementar aquí una fórmula paralela mientras siga bloqueada.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/finance.ts` — `getKpis`, `listWithdrawals`,
  `getRevenueBreakdown` (mutations en F5-11); montar `finance` en `admin/index.ts`.
- `src/app/[locale]/admin/finance/_components/finance.schema.ts` · `finance.types.ts`.
- `src/server/services/admin/finance-kpis.ts` — agregaciones tipadas y reutilizables.

Fuera de alcance: approve/rejectWithdrawal (F5-11), UI (F5-12).

## Detalle técnico

```ts
// finance.schema.ts
export const financeKpisSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),   // "2026-07"; default mes actual
});
export const listWithdrawalsSchema = z.object({
  status: z.nativeEnum(WithdrawalStatus).optional(),
  cursor: z.string().cuid().optional(),
});
export const revenueBreakdownSchema = z.object({
  months: z.number().int().min(1).max(12).default(6),
});
```

`getKpis` — result (todas las sumas server-side, mes = mes calendario):

```ts
{
  commissionCents: number;            // Σ Payment.commissionCents, createdAt en mes, status != PENDING && != REFUNDED
  commissionDeltaPct: number | null;  // vs. mes anterior; null si base 0
  subscriptionCents: number;          // Σ Invoice.amountCents PAID, issuedAt en mes
  activeBusinesses: number;
  escrowCents: number; escrowOrdersCount: number;      // Payment IN_ESCROW
  pendingWithdrawalsCents: number; pendingWithdrawalsCount: number;  // REQUESTED
}
```

`listWithdrawals` — result `{ items, nextCursor }`; item:

```ts
{
  id; amountCents; bankName; accountLast4;             // solo banco + últimos 4, jamás más
  status: WithdrawalStatus; rejectionReason: string | null;
  requestedAt: Date;                                   // createdAt
  resolvedAt: Date | null;
  business: { id; name; status: BusinessStatus };      // status para la fila deshabilitada
}
// orden: REQUESTED primero, luego createdAt desc; take 20 + cursor
```

`getRevenueBreakdown` — result:

```ts
{
  series: Array<{ month: string /* "2026-02" */; commissionCents: number; subscriptionCents: number }>;
  totals: {
    commissionCents: number;
    subscriptionCents: number;
    loyaltyBonusCents: number;        // Σ LoyaltyBonus PAID por paidAt en ventana
    loyaltyBonusPendingCents: number; // Σ PENDING al momento de consultar
  };
}
// ventana: últimos `months` meses incluyendo el actual; buckets por mes calendario
// (agrupar en TS sobre selects mínimos o $queryRaw tipado con date_trunc — sin `any`)
```

`finance-kpis.ts` expone funciones puras que reciben `db` y rangos de fecha; el router
solo orquesta (`Promise.all`) y envuelve en `ok(...)`.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse`; `adminProcedure`; 403 uniforme.
- TypeScript estricto: sin `any` (incluido `$queryRaw`: tipar el row con Zod o genérico).
- Dinero en centavos; nada se agrega/deriva en cliente.
- Prisma: `aggregate`/`groupBy` con `select` mínimo; counts en `Promise.all`.
- Datos bancarios: solo `bankName` + `accountLast4`.
- Toda procedure devuelve `{ result, error, status, message }`; los servicios internos
  usan `ServiceResult` y el router hace una sola adaptación tipada.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- [ ] Con seed: KPIs cuadran a mano (comisiones sin REFUNDED, escrow, 2 retiros REQUESTED).
- [ ] `series` trae exactamente `months` buckets contiguos (meses sin datos → 0).
- [ ] `listWithdrawals` incluye el retiro del negocio suspendido con
      `business.status = SUSPENDED`.
- [ ] Bonos pagados salen de `LoyaltyBonus.PAID/paidAt`; no existe fórmula estimada por
      número de órdenes.

## Comandos para Roger (si aplica)

No aplica.
