# [F3-05] Servicio `refundPayment`: reembolso total y parcial con liberación del resto

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §1, §2; `spec/05-admin.md` §3 (tabla de resoluciones)
- **Depende de**: `F3-04`, `XC-25`, `XC-03`
- **Tamaño estimado**: M

## Contexto

Los reembolsos nacen de la resolución de disputas (F5). Roger aprobó comisión proporcional
y saldo neto XC-03, por lo que este ticket está **DESBLOQUEADO** respecto de
`PENDIENTES.md` decisiones 1 y 2. La asignación entre principal y tarifa continúa siendo
explícita en el input. Los pagos ya `RELEASED` permanecen fuera de esta operación hasta que
otro ticket implemente Transfer Reversal; hoy retornan `PAYMENT_NOT_REFUNDABLE`.

## Alcance

- Modificar: `src/server/services/payments/escrow.ts` (agregar `refundPayment`)
- Fuera de alcance: webhook `charge.refunded` (F3-09), UI de disputas (F5).

## Detalle técnico

```ts
refundPayment(deps: { db; stripe }, input: {
  paymentId: string;
  providerRefundCents?: number;
  serviceFeeRefundCents?: number;
}):
  // ambos ausentes → reembolso TOTAL; parcial exige asignación explícita
  Promise<ServiceResult<
    { paymentId: string; stripeRefundId: string; releasedRemainderTransferId: string | null },
    "PAYMENT_NOT_REFUNDABLE" | "REFUND_EXCEEDS_LIMIT"
  >>
```

Invariantes implementables, independientes de la decisión:

1. Cargar Payment (select mínimo). Status ≠ `IN_ESCROW` → `PAYMENT_NOT_REFUNDABLE`.
2. **Total** (`amountCents` ausente): `stripe.refunds.create({ payment_intent,
   amount: payment.amountCents }, { idempotencyKey: \`refund-full-${paymentId}\` })` →
   `updateMany` condicional (`status: IN_ESCROW`) a
   `{ status: REFUNDED, refundedCents: amountCents }`. Sin Transfer. La comisión no se
   gana: los agregados de F3-06 excluyen `REFUNDED` del mes de comisiones.
3. **Parcial**: validar componentes enteros no negativos, su suma
   `0 < refundCents < payment.amountCents` y cada uno contra su saldo no reembolsado. La
   asignación principal/tarifa viene explícita del caller autorizado. Crear Refund parcial con
   `idempotencyKey: \`refund-partial-${paymentId}\`` y liberar el resto con la fórmula que
   Roger aprobó:

   ```text
   retainedProviderCents = providerAmountCents - providerRefundedCents
   effectiveCommissionCents = round(
     retainedProviderCents * commissionPctApplied / 100
   )
   providerNetCents = retainedProviderCents - effectiveCommissionCents
   ```
4. Orden crash-safe obligatorio: crear Refund y Transfer con keys determinísticas, y solo
   después persistir **en una transacción local** `providerRefundedCents`,
   `serviceFeeRefundedCents`, su suma `refundedCents`, status
   `PARTIALLY_REFUNDED`, `stripeTransferId`, `releasedAt` y exactamente un
   `LoyaltyBonus`. No marcar `PARTIALLY_REFUNDED` antes del Transfer: un fallo dejaría
   dinero varado.
5. Un retry reconcilia operaciones ya creadas por sus idempotency keys. El webhook
   `charge.refunded` puede llegar entre llamadas: F3-09 delega la reconciliación a este
   servicio y no se limita a cambiar el status, porque eso omitiría Transfer y bono.
6. Persistir `commissionCents = effectiveCommissionCents`; el bono usa esa misma comisión
   proporcional. Refund de principal + refund de tarifa +
   transfer al negocio + ingreso de plataforma retenido debe conciliar exactamente con
   `amountCents`, sin centavos creados o perdidos.

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
- [ ] Las decisiones 1 y 2 de `PENDIENTES.md` están copiadas literalmente como fórmulas;
      no queda política provisional.
- [ ] Revisión manual con fixtures documentada: refund + transfer + comisión final =
      `amountCents` para importes con redondeo.
- [ ] Firma de `refundPayment` estable para F5 (`resolve-dispute.ts`: FULL_REFUND,
      PARTIAL_REFUND la consumen).
- [ ] Idempotencia: keys determinísticas y `updateMany` condicional en cada escritura.
- [ ] Un evento `charge.refunded` intercalado no deja un parcial sin Transfer ni bono.

## Comandos para Roger (si aplica)

—
