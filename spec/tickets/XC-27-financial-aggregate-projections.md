# [XC-27] Proyectar el ledger canónico en W3, W6, W9 y W12

## Metadatos

- **Fase**: XC — proyecciones financieras transversales F2/F3/F5
- **Spec origen**: `spec/02-business-dashboard.md` §1 · `spec/03-payments.md` §1, §4, §6 ·
  `spec/05-admin.md` §1, §4 · `spec/08-business-model-alignment.md` D2–D3
- **Depende de**: `XC-25`, `XC-03`, `XC-08`, `F2-03`, `F2-04`, `F3-06`, `F3-12`,
  `F5-02`, `F5-10` y `F5-12`; las decisiones de Roger deben estar cerradas
- **Tamaño estimado**: M (1–3 h)

## Contexto

Una vez separado el principal del proveedor, la tarifa plana y la comisión, cada pantalla
debe proyectar la base correcta. Hoy W3 excluye `PARTIALLY_REFUNDED`, W6 mezcla saldos, W9
llama GMV a una suma vaga y W12 no suma la tarifa de servicio como ingreso de plataforma.
Este ticket aplica el contrato compartido de proyección sobre las lecturas ya creadas por
las fases. La serialización explícita evita que dos agentes editen esos archivos a la vez.

## Alcance

- Crear `src/server/services/payments/financial-projections.ts`: estados elegibles, bases,
  nombres de payload y helpers de proyección sobre el ledger de `XC-25`.
- Modificar, después de sus tickets propietarios, los servicios/routers de F2-03, F3-06,
  F5-02 y F5-10 para consumir esos helpers; ajustar sus payloads y el copy es/en que ya
  poseen F2-04, F3-12, F5-02 y F5-12.
- Fuera de alcance: schema y movimientos (`XC-25`), decidir refunds (`XC-03`) o retiros
  (`XC-08`), Billing y cualquier migración.

## Detalle técnico

Usar los helpers de `XC-25`; exportar nombres/funciones tipadas y no consultar Prisma desde
este archivo. Cada router aplica los filtros de tenant y periodo en su propia query.

- **W3 revenue proveedor**: principal cobrado no reembolsado de
  `IN_ESCROW|RELEASED|PARTIALLY_REFUNDED`; excluye tarifa y comisión.
- **W6 disponible**: suma `providerTransferCents` de
  `RELEASED|PARTIALLY_REFUNDED` menos retiros definidos por `XC-08`.
- **W6 escrow**: mostrar total cobrado y, si el diseño necesita el neto proveedor, exponerlo
  como campo separado; no llamar “saldo del negocio” a la tarifa retenida.
- **W9 GMV**: total efectivamente cobrado del periodo, bruto de refunds, con estados
  enumerados. Exponer aparte `refundedCents` si se muestra neto; no cambiar de definición
  según la pantalla.
- **W12 ingreso bruto plataforma**:
  `commissionCents + serviceFeeCentsApplied - serviceFeeRefundedCents`.
- **W12 ingreso neto**: ingreso bruto plataforma + suscripciones `Invoice PAID` −
  `LoyaltyBonus PAID`. Bonos pendientes no reducen ingreso pagado, pero se muestran como
  pasivo operativo separado.
- Nombres uniformes: `escrowOrdersCount` en todos los payloads; montos terminan en `Cents`.

Los rangos temporales usan mes calendario y el campo de evento documentado (`createdAt`,
`issuedAt` o `paidAt`); cada serie declara cuál, para evitar sumar una factura en dos meses.

## Restricciones no negociables

- `TrpcResponse` uniforme y códigos de error estables.
- TypeScript estricto, sin `any`; cálculos solo en servidor.
- Dinero en centavos; UI solo formatea.
- Copy únicamente next-intl es/en.
- **Sin pruebas automatizadas**: `pnpm typecheck`, `pnpm check`, `pnpm build` y conciliación
  manual contra el seed.
- Sin comandos de BD ni Stripe.

## Criterios de aceptación

- [ ] El mismo fixture concilia W3, W6, W9 y W12 sin doble contar tarifa/comisión.
- [ ] `PARTIALLY_REFUNDED` aparece en revenue/disponible con la base fijada por `XC-03`.
- [ ] W12 incluye tarifa plana neta y resta solo bonos `PAID`.
- [ ] Payloads financieros usan nombres `*Cents` y `escrowOrdersCount` uniformes.
- [ ] Cero fórmulas monetarias autoritativas en componentes cliente.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (solo lectura y proyecciones sobre el schema ya migrado).
