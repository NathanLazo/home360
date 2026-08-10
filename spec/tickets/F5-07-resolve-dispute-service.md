# [F5-07] Implementar servicio transaccional `resolveDispute` (escrow)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §3 (tabla de resoluciones), `spec/03-payments.md` §1–2 (`escrow.ts`: releasePayment/refundPayment), `spec/00-foundations.md` §3 (Dispute, Payment, Order)
- **Depende de**: `F5-01`, `F0-12`, `F3-04`, `F3-05`, `XC-11`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: **DESBLOQUEADO**. La rama `PARTIAL_REFUND` consume la comisión proporcional
  de F3-05 y el saldo neto de XC-03.

## Contexto

Corazón de W11: `src/server/services/disputes/resolve-dispute.ts` aplica una de las 4
resoluciones moviendo (o no) el dinero vía los servicios de escrow de F3, de forma
**transaccional e idempotente**.

**Problemas detectados y resolución** (la tabla de la spec deja huecos):

1. **Estado final de `Order`** solo se define para FULL_REFUND (CANCELLED).
   **Resolución**: `PARTIAL_REFUND` y `RELEASE_PAYMENT` → `Order.status = COMPLETED`
   (el servicio se dio/entregó; la disputa se zanjó con dinero); `MORE_EVIDENCE` no toca
   la orden (sigue DISPUTED).
2. **Comisión en refund parcial**: se aplica la comisión proporcional aprobada. Este ticket
   consume la fórmula canónica de F3-05/XC-03, usa el mismo límite y propaga el mismo código
   estable que `F3-05`; queda
   prohibido reexpresarlo como otro error o recalcular una segunda verdad en F5.
   La asignación también consume la política aprobada de tarifa: `FULL_REFUND` devuelve toda
   `serviceFeeCentsApplied`; `PARTIAL_REFUND` exige principal y tarifa separados, y solo
   devuelve la porción de tarifa autorizada explícitamente, que puede ser cero.
3. **MORE_EVIDENCE** "permanece IN_REVIEW", pero las disputas nacen OPEN y nada en la spec
   las pasa a IN_REVIEW. **Resolución**: MORE_EVIDENCE hace `status = IN_REVIEW` (desde
   OPEN o IN_REVIEW); **no** persiste `resolution` ni `resolvedAt` (no es una resolución
   terminal aunque viva en el enum `DisputeResolution` — ver findings).
4. **Carrera con auto-liberación (F3)**: `releaseDuePayments()` no excluye órdenes
   disputadas en la spec original. `F3-04` ya corrige la implementación excluyendo toda
   disputa no resuelta. F5 mantiene la defensa: toda resolución monetaria exige
   `Payment.status === IN_ESCROW`; si no → `CONFLICT`. `RELEASING` es explícitamente
   conflicto: la reclamación previa al Transfer es el punto de no retorno y no se puede
   abrir, reabrir ni resolver una disputa en paralelo con esa operación.
   La creación o reapertura de una disputa debe, en una transacción serializable, comprobar
   y escribir condicionalmente el `Payment` todavía `IN_ESCROW` antes de insertar la disputa;
   una lectura previa sin CAS no coordina la carrera con `releasePayment`.
5. Una transacción Prisma no puede volver atómicas llamadas Stripe. No se llama a Stripe
   dentro de una transacción interactiva ni se promete rollback del dinero externo.
   `resolveDispute` delega en los servicios crash-safe e idempotentes de F3 y solo finaliza
   `Dispute`/`Order` después de comprobar su resultado. F3 acepta replay de la misma
   operación y reconoce el estado externo/local ya aplicado; F5 no simula atomicidad.

## Alcance

Crear/modificar:

- `src/server/services/disputes/resolve-dispute.ts`.
- `prisma/schema.prisma` — agregar a `Dispute` únicamente la trazabilidad exigida por D6:
  `resolutionNotes String?` y `recordingCompleteAtResolution Boolean?`.
- Ajuste puntual de `src/server/services/payments/escrow.ts` **solo si hace falta** para:
  (a) que `refundPayment(partialCents)` deje `PARTIALLY_REFUNDED` y libere el resto neto
  (F3 ya lo especifica: "parcial libera el resto"), y (b) aceptar claves de idempotencia
  Stripe por parámetro. Sin cambios de firma incompatibles con F3.

Fuera de alcance: router `admin.disputes` (F5-08), UI (F5-09), cron de F3.

## Detalle técnico

Firma:

```ts
type ResolveDisputeInput = {
  disputeId: string;
  resolution: DisputeResolution;          // enum Prisma
  providerRefundCents?: number;
  serviceFeeRefundCents?: number;
  justification?: string;
};
resolveDispute(deps: { db: PrismaClient; stripe: Stripe }, input: ResolveDisputeInput)
  : Promise<ServiceResult<{ id: string }, ResolveDisputeError>>
```

Flujo:

1. Cargar dispute con `select` mínimo: `{ id, status, orderId, order: { id, status,
   recordingUrl, recordingComplete,
   payment: { id, status, amountCents, commissionCents, refundedCents } } }`.
   No existe → `NOT_FOUND`. `status === RESOLVED` → `CONFLICT` (doble resolve).
1b. **Regla de la grabación (D6)**. El deck y la app son explícitos: la grabación del
   servicio es obligatoria e ininterrumpida, y su ausencia resuelve la disputa a favor del
   cliente. Si `recordingUrl` es null o `recordingComplete === false`:
   - `FULL_REFUND` procede sin fricción.
   - Cualquier otra resolución exige `justification` (string no vacío, mínimo ~20
     caracteres) en el input → si falta,
     `RECORDING_JUSTIFICATION_REQUIRED` (400).
   - La justificación se persiste en `Dispute.resolutionNotes` junto con
     `recordingCompleteAtResolution`; es la trazabilidad mínima exigida por D6.
   Con grabación completa, `justification` es opcional y todas las resoluciones son iguales.
2. Validaciones por resolución:
   - `PARTIAL_REFUND`: `providerRefundCents` y `serviceFeeRefundCents` requeridos como
     enteros no negativos, aunque uno sea cero; su suma debe ser > 0. Límite, cálculo de
     comisión proporcional, neto y código de error vienen **sin traducción** de F3-05/XC-03.
     El admin autoriza así de forma explícita qué porción de tarifa devolver; F5 no la infiere.
   - `FULL_REFUND` / `PARTIAL_REFUND` / `RELEASE_PAYMENT`: sin `Payment` o
     `payment.status !== IN_ESCROW` → `CONFLICT` (cubre auto-release previo).
   - `MORE_EVIDENCE`: sin validación monetaria.
3. Concurrencia y efectos:
   - `MORE_EVIDENCE` no toca Stripe: transacción local con `updateMany` condicional,
     `status = IN_REVIEW`, `resolution = null`, `resolvedAt = null`, y persiste la
     justificación D6 cuando aplique.
   - Para resoluciones monetarias, invocar el servicio F3 correspondiente con una
     `operationKey` determinística derivada de `disputeId` y la resolución. Nunca mantener
     una transacción Prisma abierta durante la llamada de red.
   - Tras éxito de F3, finalizar `Dispute` y `Order` en una transacción local con update
     condicional. Un retry debe detectar que Payment ya refleja **esa misma operación** y
     completar la finalización sin repetir dinero. Una resolución distinta concurrente
     retorna `CONFLICT`; no puede usar otra idempotency key sobre el mismo pago.
   - Efectos finales:

   | Resolución | Dinero (escrow.ts F3, con idempotency key) | Estados finales |
   |---|---|---|
   | `FULL_REFUND` | `refundPayment` total, incluido todo `serviceFeeCentsApplied` (`key: dispute:<id>:refund`) | Payment `REFUNDED` (`providerRefundedCents = providerAmountCents`, `serviceFeeRefundedCents = serviceFeeCentsApplied`, `refundedCents = amountCents`), Order `CANCELLED`, Dispute `RESOLVED` + `resolution` + `resolutionAmountCents = amountCents` + `resolvedAt` |
   | `PARTIAL_REFUND` | `refundPayment({ providerRefundCents, serviceFeeRefundCents })` + liberación del neto (`key: dispute:<id>:refund` / `:transfer`) | Payment `PARTIALLY_REFUNDED` (`refundedCents = providerRefundCents + serviceFeeRefundCents`), Order `COMPLETED`, Dispute `RESOLVED` + `resolutionAmountCents = refundedCents` |
   | `RELEASE_PAYMENT` | `releasePayment` completo (`key: dispute:<id>:transfer`) | Payment `RELEASED`, Order `COMPLETED`, Dispute `RESOLVED` + `resolutionAmountCents = 0` |

   - `releasePayment` de F3 sigue siendo la **única** vía que crea Transfers; si la
     implementación F3 de `refundPayment(partial)` no libera el resto, extenderla ahí
     (no duplicar lógica de Transfer en este servicio).
   - `RELEASE_PAYMENT` y el resto liberado de `PARTIAL_REFUND` devengan exactamente un
     `LoyaltyBonus` mediante la lógica de F3-04, con el `commissionCents` definitivo tras
     aplicar la política elegida. `FULL_REFUND` no devenga bono.
   - Las llamadas Stripe usan **claves de idempotencia** derivadas del `disputeId` para
     que un retry (timeout, doble submit que pase el cerrojo en procesos distintos) no
     duplique Refund/Transfer.
4. El servicio retorna `ServiceResult`; la procedure F5-08 es quien lo adapta a
   `{ result, error, status, message }`. `catch unknown` se estrecha sin `any`; Stripe →
   `STRIPE_ERROR`. Jamás se marca la disputa RESOLVED antes de verificar el efecto de F3.

Verificación manual y por inspección de estado (sin pruebas automatizadas):

- Todos los caminos producen exactamente los estados de la tabla.
- `PARTIAL_REFUND` usa exactamente el monto, límite y código de
  F3; se comprueba la invariante monetaria definida allí.
- Doble resolve → `CONFLICT`; resolver con Payment ya RELEASED → `CONFLICT`.
- `MORE_EVIDENCE` sobre OPEN → IN_REVIEW, sin `resolution`/`resolvedAt`, cero llamadas Stripe.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- El servicio usa `ServiceResult`; la procedure usa `TrpcResponse`. Errores estables
  (`RECORDING_JUSTIFICATION_REQUIRED`, el código canónico de F3 para el parcial,
  `CONFLICT`, `NOT_FOUND`, `STRIPE_ERROR`).
- Transacción Prisma para los efectos atómicos; `stripe` y `db` inyectados por parámetro.
- Ninguna llamada Stripe dentro de una transacción Prisma.
- TypeScript estricto: sin `any`; enums de Prisma, no strings sueltos.
- Identificadores en inglés. Dinero en centavos.
- No modificar el contrato público de los servicios F3 de forma incompatible.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- [ ] Ningún camino deja estados intermedios: o todo el conjunto Dispute/Payment/Order
      converge al estado de la operación idempotente; un crash entre Stripe y BD se
      recupera reintentando sin duplicar dinero.
- [ ] Segundo resolve (mismo u otro admin) → `CONFLICT` sin tocar Stripe.
- [ ] Sin grabación completa, toda resolución distinta de `FULL_REFUND` exige justificación
      y esta queda persistida junto con el estado de la grabación (D6).
- [ ] `PARTIAL_REFUND` usa la comisión proporcional de F3-05 y el balance neto de XC-03.
- [ ] `FULL_REFUND` devuelve toda la tarifa y `PARTIAL_REFUND` pasa a F3 la asignación
      explícita principal/tarifa; Payment `RELEASED` se rechaza sin Transfer Reversal.

## Comandos para Roger (si aplica)

Después de revisar la migración generada para los dos campos de trazabilidad:

```bash
pnpm prisma migrate dev --name add_dispute_resolution_trace
```

La verificación manual con Stripe se hace en F5-09.
