# [F3-12] W6 `/dashboard/payments`: vista, tarjetas de saldo y tabla de transacciones

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §6
- **Depende de**: `F3-11`
- **Tamaño estimado**: L

## Contexto

Primera mitad de W6: página, orquestador, 3 tarjetas de saldo (Disponible / Retenido en
escrow / Comisión del mes con el % del plan) y tabla de transacciones con badges por
estado. Todos los montos llegan del servidor en centavos y se formatean con next-intl;
la UI no suma ni deriva nada.

## Alcance

- Crear: `src/app/[locale]/dashboard/payments/page.tsx`, `loading.tsx`, `error.tsx`
- Crear en `src/app/[locale]/dashboard/payments/_components/`:
  `payments-view.tsx`, `balance-cards.tsx`, `transactions-table.tsx`,
  `payment-status-badge.tsx`, `payment.types.ts`
- Modificar: `src/messages/es/dashboard.json`, `src/messages/en/dashboard.json`,
  `src/messages/es/errors.json`, `src/messages/en/errors.json`
- Fuera de alcance: header actions, dialogs, banner de onboarding y hook de mutations
  (F3-13); `payment.schema.ts` ya existe (F3-11).

## Detalle técnico

- `page.tsx`: Server Component delgado; prefetch de `payment.getBalances` y
  `payment.listTransactions` (patrón HydrationBoundary del scaffold T3) y render de
  `<PaymentsView />`. `loading.tsx` con `Skeleton` de cards + tabla.
- `payments-view.tsx` consume el envelope `TrpcResponse`: renderiza datos solo desde
  `response.result` cuando `error === null`; un fallo de dominio no se trata como payload
  vacío ni se accede a campos en la raíz del envelope.
- `balance-cards.tsx`: 3 `KpiCard` (F0): `availableCents`, `escrowCents` (+ subtexto
  `escrowOrdersCount` órdenes), `monthCommissionCents` con el `%` desde
  `ctx.business.plan` expuesto por `getBalances`… el % llega en el payload de
  `subscription.getCurrent`? No: para no acoplar a F4, el label usa
  `commissionPctApplied` **no**; resolución: `getBalances` de F3-11 ya retorna solo montos;
  el % del plan se muestra desde una prop servida por el `page.tsx` vía
  `api.subscription`… F4 no existe aún. **Resolución final**: el título de la card es
  genérico "Comisión del mes" (i18n) sin %, y F4-08 lo enriquece. Documentado aquí para
  no bloquear F3.
- `transactions-table.tsx`: usa `data-table.tsx` (F0) con columnas cliente, concepto,
  monto (Geist Mono, `useFormatter().number(cents / 100, { style: "currency",
  currency: "MXN" })` — única división permitida, es formateo), método, estado
  (`payment-status-badge.tsx`), fecha relativa (`useFormatter().relativeTime`). Botón
  "Cargar más" con `nextCursor` (useInfiniteQuery de tRPC).
- `payment-status-badge.tsx`: mapa exhaustivo tipado `PaymentStatus → variante`:
  `PENDING` azul ("Pendiente", nunca "Pagado"), `IN_ESCROW` ámbar, RELEASED verde, REFUNDED gris,
  `PARTIALLY_REFUNDED` gris con texto propio).
- `payment.types.ts`: tipos inferidos del router (`RouterOutputs["payment"]…`), cero
  duplicación manual.
- i18n: namespace `dashboard.payments.*` (títulos, columnas, estados, vacíos) en es/en;
  `errors.json` ya cubre códigos (F3-11 no introdujo códigos sin clave — verificar
  `INSUFFICIENT_BALANCE`, `NO_CONNECT_ACCOUNT`, `DISPUTE_OPEN`, `PAYMENT_NOT_RELEASABLE`,
  `ORDER_NOT_FOUND` y agregarlos a `errors.json` es/en si faltan).
- `empty-state.tsx` (F0) cuando no hay transacciones.
- Mostrar `availableCents` desde el servidor con la fórmula neta XC-03; habilitar el CTA de
  retiro manual solo cuando Connect esté listo y el saldo alcance.

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

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde;
      `/dashboard/payments` navegable es/en.
- [ ] 3 tarjetas de saldo y tabla replican el diseño W6; badges por estado correctos.
- [ ] Ningún monto calculado en cliente (solo formateo `cents / 100`).
- [ ] Estados loading/error/empty presentes.

## Comandos para Roger (si aplica)

—
