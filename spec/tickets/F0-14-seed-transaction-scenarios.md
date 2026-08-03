# [F0-14] Completar escenarios transaccionales del seed

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §9; `spec/08-business-model-alignment.md` D1,
  D3, D5, D8
- **Depende de**: `F0-11`, `XC-25`
- **Tamaño estimado**: L (3–6 h)

## Contexto

F0-11 deja listos planes, usuarios, negocios y catálogo. Este ticket completa por separado
los escenarios que F2–F5 necesitan para verificación manual: solicitudes/cotizaciones,
órdenes, pagos, disputas, reseñas y bonos. Los retiros dependen de la decisión 3 de
`PENDIENTES.md` y se siembran, si aplica, en F3-07 una vez elegido el contrato. La separación
evita que un único ticket
de seed exceda el límite de contexto y mantiene una sola entrada idempotente
`prisma/seed.ts`.

## Alcance

Crear:

- `prisma/seed/marketplace.ts` — solicitudes y cotizaciones.
- `prisma/seed/orders.ts` — órdenes, disputas y reseñas.
- `prisma/seed/payments.ts` — pagos y bonos con el ledger de `XC-25`.

Modificar:

- `prisma/seed.ts` — invocar los tres módulos después de los módulos base de F0-11.

Fuera de alcance: ejecutar el seed o migraciones, datos reales de Stripe, mensajería,
publicidad, cuentas corporativas completas y cualquier UI/servicio de dominio.

## Detalle técnico

Todos los módulos reciben el cliente Prisma y los IDs tipados que devuelve F0-11; no hacen
queries por nombre para reconstruir contexto ni usan estado global. Usar tipos generados
`Prisma.*CreateInput`/`Prisma.*UncheckedCreateInput` cuando aporten precisión y IDs
deterministas para cada entidad sin clave natural.

### Marketplace

- 1 `ServiceRequest` `OPEN` con 3 `Quote` `PENDING` de negocios distintos.
- 1 `ServiceRequest` `ACCEPTED` y una `Quote` `ACCEPTED` que apunta mediante
  `Order.quoteId` a una de las órdenes de servicio creadas por este ticket.
- Respetar `@@unique([requestId, businessId])`; una ejecución posterior actualiza y no
  duplica solicitudes ni cotizaciones.

### Órdenes y evidencia

- Crear ~15 órdenes de Plomería García, repartidas entre sucursales/clientes y escalonadas
  en las últimas 8 semanas.
- Mezclar `SERVICE`/`PRODUCT` y estados `PENDING`, `PAID`, `IN_PROGRESS`, `COMPLETED`,
  `CANCELLED`, `SHIPPING` y `DISPUTED`; `SHIPPING` solo puede aparecer en órdenes PRODUCT.
- Usar `quantity > 1` en algunas órdenes de producto.
- Las órdenes de servicio completadas/disputadas llevan `recordingUrl`; al menos una
  disputada tiene `recordingComplete: false` para ejercitar D6, y otra evidencia completa
  (`recordingDurationSec`, `beforeUrls`, `afterUrls`, `workNotes`, `OrderMaterial`).
- Crear 2 disputas sobre órdenes `DISPUTED`: una `URGENT` con `aiSummary`/`evidenceUrls` y
  una `NORMAL` abierta.
- Crear reseñas solo sobre órdenes `COMPLETED`, mayoría 5 y alguna 4, para promedio ≈ 4.9.

### Pagos y bonos

- Crear un pago para toda orden no-PENDING. `Payment.orderId` apunta a exactamente una
  orden y `paymentLinkId` queda `null`.
- Mapeo: orden PAID/IN_PROGRESS → `IN_ESCROW` con `escrowReleaseAt` futuro; COMPLETED →
  `RELEASED` con `releasedAt`; CANCELLED → `REFUNDED` con
  `refundedCents = amountCents`; DISPUTED → `IN_ESCROW`; SHIPPING → `IN_ESCROW`.
- Para cada pago congelar `providerAmountCents`, `serviceFeeCentsApplied`,
  `providerRefundedCents` y `serviceFeeRefundedCents` conforme a `XC-25`;
  `amountCents = providerAmountCents + serviceFeeCentsApplied`.
- Para el negocio standard, congelar `commissionPctApplied = 8` y
  `commissionCents = round(providerAmountCents * 0.08)`. La tarifa plana nunca forma parte
  de la base de comisión ni del neto proveedor.
- Variar `PaymentMethod`; los IDs de Stripe permanecen `null`.
- No crear `Withdrawal` en F0: `REQUESTED` solo existe como fixture si Roger adopta el flujo
  manual de `XC-08`; el flujo automático requiere otra semántica y no se inventa aquí.
- Por cada pago `RELEASED`, crear exactamente un `LoyaltyBonus` con
  `amountCents = round(commissionCents * 0.5)` y `pctApplied = 50`. Dejar al menos uno
  `PAID` con `VOUCHER`, otro `PAID` con `TRANSFER` y el resto `PENDING`.

Reglas de implementación:

- El orden de orquestación es marketplace base → órdenes → vínculo de cotización aceptada
  → pagos/bonos, o una forma equivalente que respete las FKs sin writes temporales inválidos.
- Cuando una relación de varias entidades deba mantenerse coherente, agrupar sus upserts en
  una transacción Prisma. No usar SQL crudo.
- El seed completo puede ejecutarse repetidamente sin duplicar ni acumular importes. El
  agente verifica esto por lectura y tipos; **no ejecuta** `pnpm db:seed`.
- Capturar errores como `unknown`, establecer `process.exitCode` en el orquestador y cerrar
  Prisma en `finally`; sin logs de secretos ni payloads sensibles.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Prisma.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] El inventario transaccional de `spec/00` §9 está cubierto sin duplicar el trabajo base
      de F0-11.
- [ ] Los estados Order/Payment son coherentes, incluyendo SHIPPING solo para productos.
- [ ] Todo pago `RELEASED` tiene un único bono al 50 %; existen bonos PENDING, VOUCHER y
      TRANSFER.
- [ ] Los escenarios incluyen disputa urgente, evidencia completa/incompleta, rating ≈ 4.9,
      ledger principal/tarifa conciliable y cotización aceptada enlazada a una orden.
- [ ] Todos los upserts tienen clave natural o ID determinista; no hay `any`, SQL ni
      ejecución de comandos de datos.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde sin ejecutar el seed.

## Comandos para Roger (si aplica)

Solo después de revisar la migración de F0-03/F0-12 y el seed completo F0-11/F0-14:

```bash
pnpm db:seed
```
