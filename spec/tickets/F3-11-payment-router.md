# [F3-11] Router tRPC `payment`: saldos, transacciones, onboarding, links, retiros y confirmación

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §3, §4; `spec/00-foundations.md` §4–5
- **Depende de**: `F3-02`…`F3-08`
- **Tamaño estimado**: L

## Contexto

Capa de transporte sobre los servicios de F3: valida input con Zod, resuelve el tenant
desde `ctx.business` (jamás del input), traduce `ServiceResult` → `TrpcResponse`. Detalle
de la spec respetado: `getBalances`/`listTransactions` usan `businessProcedure` (un negocio
PENDING/SUSPENDED puede *ver*), mientras que `startOnboarding`/`createPaymentLink`/
`requestWithdrawal` usan `activeBusinessProcedure` (solo negocios ACTIVE mueven dinero).
`confirmDelivery` es `userProcedure` (cliente móvil futuro) y libera el escrow de su orden.

## Alcance

- Crear: `src/server/api/routers/payment.ts`
- Modificar: `src/server/api/root.ts` (registrar `payment`)
- Crear: `src/server/api/routers/payment.schema.ts` (inputs Zod y códigos de dominio del
  router; el backend nunca importa desde una carpeta privada de UI)
- Fuera de alcance: componentes de UI (F3-12/F3-13).

## Detalle técnico

`payment.schema.ts` — códigos de dominio como literales (patrón F0 §4):

```ts
export const paymentErrorCodes = [
  "INSUFFICIENT_BALANCE", "NO_CONNECT_ACCOUNT", "PAYMENT_NOT_RELEASABLE",
  "DISPUTE_OPEN", "ORDER_NOT_FOUND", "INVALID_TARGET", "REFUND_EXCEEDS_LIMIT",
  "CORPORATE_PRICING_NOT_AVAILABLE",
] as const;
export const createPaymentLinkSchema = z.object({
  concept: z.string().trim().min(3).max(120),
  providerAmountCents: z.number().int().positive().max(50_000_000),
});
export const requestWithdrawalSchema = z.object({
  amountCents: z.number().int().positive(),
  bankName: z.string().trim().min(2).max(60),
  accountLast4: z.string().regex(/^\d{4}$/),
});
export const listTransactionsSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  cursor: z.string().cuid().optional(),
});
```

Procedures (todas retornan `TrpcResponse`; mapeo exhaustivo y tipado
`ServiceResult.code` → `fail(code, …)`: validación/objetivo inválido → 400;
`NOT_FOUND`/`ORDER_NOT_FOUND` → 404; conflictos de estado, saldo, disputa o pricing no
disponible → 409; `STRIPE_ERROR` → 502; inesperado normalizado → 500):

| Procedure | Proc | Detalle |
|-----------|------|---------|
| `getBalances` | business | `getBusinessBalances({ db }, { businessId: ctx.business.id })` → `{ availableCents, escrowCents, monthCommissionCents, escrowOrdersCount, loyaltyPendingCents }`; queda bloqueado hasta cerrar PENDIENTES #1–#3 |
| `listTransactions` | business | Query Prisma paginada (take 20 + cursor por `id`, orden `createdAt desc`) sobre `Payment` filtrado por `businessId` del ctx; `select` mínimo con `order { title, customer { name } }` y `paymentLink { concept }`; mapear a fila `{ id, customerName: string \| null, concept, amountCents, method, status, createdAt }` (`concept` = order.title o paymentLink.concept). Resultado `{ items, nextCursor }` |
| `getConnectStatus` | business | Leer flags locales; si hay cuenta y `onboarding=complete` la mutation/flujo explícito refresca con `getAccountStatus`. Resultado `{ hasAccount, chargesEnabled, payoutsEnabled }`; una query de render no necesita golpear Stripe |
| `refreshConnectStatus` | business | Llamar `getAccountStatus` tras volver de onboarding y persistir flags; resultado igual a `getConnectStatus`. Rate-limit por usuario/negocio para no convertirlo en proxy abierto a Stripe |
| `startOnboarding` | active | `createConnectAccount` + `createOnboardingLink` con `returnUrl = {origin}/{locale}/dashboard/payments?onboarding=complete`, `refreshUrl = …?onboarding=refresh` → `{ url }` |
| `createPaymentLink` | active | schema Zod ↑ → `createPaymentLink` service → `{ id, url }` |
| `requestWithdrawal` | active | Solo si Roger adopta la rama manual de `XC-08`: schema Zod ↑ → servicio y revalidación server-side contra saldo → `{ id }`. En rama automática no registrar esta procedure. |
| `confirmDelivery` | user | `{ orderId: z.string().cuid() }`; cargar orden con `where: { id, customerId: ctx.customer.id }` (tenant en query) e incluir `payment { id, status }`; sin orden → `ORDER_NOT_FOUND` 404 (sin revelar existencia ajena); aceptar retry si el payment ya está `RELEASED`; `releasePayment` + `Order.status = COMPLETED` con `updateMany` condicional desde los estados explícitamente entregables |

- `try/catch` con `normalizeError` (F0) en cada procedure; nunca stack traces al cliente.
- Cada rama retorna exactamente `{ result, error, status, message }`: éxito con
  `error: null`; fallo con `result: null`, código literal y mensaje de referencia en inglés.
- El retiro manual viaja como `amountCents`; el link envía solo `providerAmountCents`.
  Tarifa y total se calculan en servidor conforme a `XC-25`.
- `listTransactions` usa orden estable
  `[{ createdAt: "desc" }, { id: "desc" }]`; el cursor no puede omitir/duplicar filas con
  el mismo timestamp.
- `confirmDelivery` no envuelve Stripe en una transacción BD. La idempotencia de F3-04
  permite repetir después de un crash entre Transfer y `Order.COMPLETED`; la actualización
  de orden nunca ocurre si la liberación falla.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Roles correctos por procedure (business vs active vs user); FORBIDDEN uniforme.
- [ ] `confirmDelivery` de una orden ajena → `ORDER_NOT_FOUND` sin filtrar información.
- [ ] Cursor pagination estable en `listTransactions`.
- [ ] Todas las respuestas, incluidos fallos, cumplen las cuatro claves de `TrpcResponse`;
      no hay `any`, casts amplios ni schemas importados desde `_components`.

## Comandos para Roger (si aplica)

—
