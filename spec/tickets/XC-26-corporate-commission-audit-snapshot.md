# [XC-26] Congelar la referencia de comisión para órdenes corporativas

## Metadatos

- **Fase**: XC — contrato transversal F3/F7
- **Spec origen**: `spec/08-business-model-alignment.md` D1, D4 ·
  `spec/09-corporate-accounts.md` §3, §5
- **Depende de**: `XC-25`, `F3-03` y `F7-01`
- **Tamaño estimado**: M (1–3 h)

## Contexto

F7-05 promete que `savedByRateCents` es exacto y auditable comparando la comisión que habría
aplicado el plan del proveedor con `Payment.commissionPctApplied`. Pero `Payment` solo congela
la tasa efectiva; si el proveedor cambia de plan, la tasa de referencia histórica se pierde.
Consultar el plan actual reescribe el pasado. Este ticket congela ambos lados del comparativo
al capturar, sin cambiar la precedencia D1.

## Alcance

- `Payment`: snapshot de tasa, monto y fuente de la comisión de referencia.
- Crear `src/server/services/payments/commission-resolution.ts` con
  `CommissionResolution` y cálculo sobre el principal de `XC-25`.
- F7-03 conserva ownership de la rama corporativa/captura; F7-05 conserva ownership de
  `savedByRateCents`; F7-06 conserva ownership del copy/UI.
- Fuera de alcance: editar esos módulos F7, CRUD corporativo, UI, precios/tier, seed y
  migraciones ejecutadas.

## Detalle técnico

El helper que consume F7-03 deja de retornar un número desnudo:

```ts
type CommissionResolution = {
  effectivePct: number;
  providerPlanPct: number;
  source: "PROVIDER_PLAN" | "CORPORATE_ACCOUNT";
};
```

`Payment` gana:

```prisma
providerPlanCommissionPctApplied Int
providerPlanCommissionCents      Int
commissionSource                 CommissionSource
```

`CommissionSource` es enum Prisma `PROVIDER_PLAN | CORPORATE_ACCOUNT`.

Reglas:

1. Siempre resolver primero el plan vigente del proveedor y congelar su porcentaje.
2. Si la orden referencia una `CorporateAccount ACTIVE`, `effectivePct` sale de la cuenta;
   si está PENDING/SUSPENDED/CANCELLED o no existe, ambos porcentajes son el del proveedor.
3. Calcular ambos montos sobre la misma base de principal definida por `XC-25`.
4. `commissionPctApplied`/`commissionCents` siguen siendo los valores efectivos que gobiernan
   transfer, bonos D3 e ingreso real.
5. F7-05, una vez resuelto `XC-03`, calcula `savedByRateCents` como
   `max(0, providerPlanCommissionCents - commissionCents)` de pagos corporativos elegibles.
   Los estados/refunds elegibles deben ser exactamente los fijados en `XC-03`; no consultar
   el plan/tier actual.
6. `updateTerms` y cambios de plan no actualizan ningún snapshot de `Payment`.
7. Una orden corporativa debe tener `corporateLocationId` perteneciente a la misma cuenta;
   F7-01 crea ambas FKs y el servicio de creación valida la igualdad.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure.
- TypeScript estricto, sin `any` ni casts; Prisma/Zod/tRPC como fuentes de tipos.
- Dinero en centavos `Int`; cálculos solo en servidor.
- Tenant corporativo desde sesión y filtro dentro de Prisma.
- Copy solo vía next-intl es/en.
- **Sin pruebas automatizadas**: `pnpm typecheck`, `pnpm check`, `pnpm build` y verificación
  manual con snapshots antes/después de cambios de plan/tier.
- BD: solo `pnpm prisma generate`; Roger ejecuta migraciones/seed.

## Criterios de aceptación

- [ ] Pago corporativo congela tasa efectiva y tasa de referencia del proveedor.
- [ ] Cambiar posteriormente plan proveedor o términos corporativos no cambia el ahorro
      histórico.
- [ ] Cuenta no ACTIVE cae al plan proveedor y produce ahorro cero.
- [ ] `savedByRateCents` no consulta configuración actual ni usa `Float`.
- [ ] Bono D3 sigue calculándose sobre `commissionCents` efectivo, no sobre el baseline.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

La migración se prepara como archivo y la ejecuta Roger tras revisarla.
