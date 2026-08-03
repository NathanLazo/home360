# [F5-16] Liquidación de bonos de lealtad en finanzas (W12)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/08-business-model-alignment.md` D3 · `spec/05-admin.md` §4 (W12)
- **Depende de**: `F0-12`, `F3-04` (devengo), `F5-10`, `F5-12`
- **Tamaño estimado**: M (1–3 h)

## Contexto

El diseño de W12 muestra "Bonos de lealtad pagados" como línea **negativa** del desglose de
ingresos, pero hasta ahora no existía nada que los generara ni los pagara: era el hallazgo
`XC-06` / `F5-7`. Con D3 el bono es el 50 % del fee, `F3-04` lo devenga al liberar cada pago,
y este ticket cierra el ciclo dándole al admin la cola de liquidación.

El bono **no** es un retiro: no sale del saldo de escrow ni pasa por Stripe Connect. Se paga
en vales de gasolina o despensa (deducibles, que es la razón fiscal del programa) o por
transferencia directa fuera de la plataforma. El sistema registra la liquidación, no la
ejecuta.

## Alcance

Crear:

- `src/server/services/admin/loyalty-payouts.ts`
- `src/app/[locale]/admin/finance/_components/loyalty-bonuses-table.tsx`
- `src/app/[locale]/admin/finance/_components/loyalty-bonus-row-actions.tsx`
- `src/app/[locale]/admin/finance/_components/pay-loyalty-bonus-dialog.tsx`

Modificar:

- `src/server/api/routers/admin/finance.ts` (procedures nuevas)
- `src/app/[locale]/admin/finance/_components/finance-view.tsx` (montar la sección)
- `src/app/[locale]/admin/finance/_components/revenue-breakdown-list.tsx` (línea negativa
  con dato real)
- `src/messages/{es,en}/admin.json`

Fuera de alcance: devengo (F3-04), saldo del negocio (F3-06), cualquier integración con un
proveedor de vales.

## Detalle técnico

### Procedures (`admin.finance`, todas `adminProcedure`)

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `listLoyaltyBonuses` | `{ status?: LoyaltyBonusStatus, businessId?, cursor? }` | `{ items, nextCursor }`; negocio, monto, pago origen, `pctApplied`, estado, fecha de devengo |
| `payLoyaltyBonus` | `{ bonusId, method: "VOUCHER" \| "TRANSFER", notes? }` | `{ id }` · `NOT_FOUND` · `CONFLICT` si ya está `PAID` |
| `cancelLoyaltyBonus` | `{ bonusId, reason }` | `{ id }` · `CONFLICT` si ya está `PAID` |

`payLoyaltyBonus` en el servicio, con cerrojo condicional para que dos admins no lo paguen
dos veces:

```ts
db.loyaltyBonus.updateMany({
  where: { id: bonusId, status: "PENDING" },
  data: { status: "PAID", method, paidAt: now, notes },
});
// count === 0 ⇒ CONFLICT (ya pagado o cancelado por otro admin)
```

- `listLoyaltyBonuses`: `take 20 + 1`, cursor por `id`, orden estable
  `createdAt desc, id desc`, `select` mínimo. `businessId` es un filtro administrativo
  explícito, no un tenant.
- `cancelLoyaltyBonus` usa el mismo gate `where { id, status: PENDING }`; `reason` se
  persiste en `notes`. PAID y CANCELLED retornan `CONFLICT`.
- Los servicios retornan `ServiceResult`; el router adapta una sola vez a
  `{ result, error, status, message }`.

### Desglose de ingresos (cierra XC-06)

`getRevenueBreakdown` (F5-10) ya define `loyaltyBonusCents` como Σ `amountCents` de bonos
`PAID` por `paidAt` dentro del periodo. Este ticket invalida esa query tras pagar/cancelar
y presenta el dato **en negativo**, como pide el diseño:

```text
Comisiones           +$X
Suscripciones        +$Y
Bonos de lealtad     −$Z      ← dato real, ya no estimación
Ingreso neto          $X+Y−Z
```

Con D3 la relación esperada es `Z ≈ X / 2` sobre los pagos ya liberados y liquidados: si el
desglose se aleja mucho de esa proporción, es señal de bonos sin liquidar acumulados, no de
un error de cálculo. Conviene mostrar también el pendiente como nota.

### UI

- Sección propia en W12, bajo la tabla de retiros: tabs `Pendientes` / `Pagados`.
- Columnas: negocio, monto, % aplicado, pago origen (link a la orden), devengado el, estado.
- `pay-loyalty-bonus-dialog.tsx`: `AlertDialog` con el monto, un `Select` de método
  (vales / transferencia) y notas opcionales; el copy deja claro que registra un pago hecho
  fuera de la plataforma.
- Estados vacíos con el patrón `EmptyState` ya existente.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Todo el namespace admin con `adminProcedure`; 403 uniforme sin revelar si el recurso existe.
- TypeScript estricto: sin `any`; enums de Prisma, no strings sueltos.
- Identificadores y rutas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- `payLoyaltyBonus` solo registra una liquidación ya realizada fuera de HOME360; no llama
  a Stripe, no crea `Withdrawal` y no mueve escrow.

## Criterios de aceptación

- [ ] La línea "Bonos de lealtad pagados" de W12 sale de datos reales, no de una estimación.
- [ ] `payLoyaltyBonus` es idempotente ante doble clic y ante dos admins simultáneos
      (`updateMany` condicional, `CONFLICT` si `count === 0`).
- [ ] Un bono pagado no puede volver a `PENDING` ni cancelarse.
- [ ] Un bono cancelado tampoco puede pagarse ni cancelarse de nuevo.
- [ ] El bono nunca aparece sumado al saldo disponible ni al escrow del negocio.
- [ ] Lista paginada y todas las procedures con contrato tRPC uniforme y autorización
      `adminProcedure`.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
