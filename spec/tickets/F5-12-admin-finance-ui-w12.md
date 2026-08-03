# [F5-12] Implementar UI de W12 — Finanzas `/admin/finance`

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §4 (módulo)
- **Depende de**: `F5-10`, `F5-11`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: la lectura es implementable; las acciones de aprobación permanecen
  deshabilitadas mientras `F5-11` esté bloqueado por `PENDIENTES.md` §3.

## Contexto

Pantalla financiera del admin: KPIs, tabla de retiros con aprobación/rechazo, gráfica de
ingresos (comisiones vs. suscripciones) y desglose con bonos de lealtad en negativo.

**Decisión (hueco de spec)**: el retiro de un negocio suspendido se muestra como fila
deshabilitada con nota "Cuenta suspendida" (diseño W12) — la condición es
`item.business.status === "SUSPENDED"` del result de F5-10; las acciones de la fila se
ocultan (y el server además lo bloquea, F5-11).

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/finance/page.tsx` · `loading.tsx` · `error.tsx`.
- `src/app/[locale]/admin/finance/_components/`:
  `finance-view.tsx`, `finance-kpi-row.tsx`, `withdrawals-table.tsx`,
  `withdrawal-row-actions.tsx`, `platform-revenue-chart.tsx`,
  `revenue-breakdown-list.tsx`, `use-withdrawal-mutations.ts`.
- `src/messages/{es,en}/admin.json` — sección `finance`.

Fuera de alcance: procedures (F5-10/11), export de reportes.

## Detalle técnico

- `finance-kpi-row.tsx`: `KpiCard`s — Comisiones del mes (+delta %), Suscripciones del
  mes, En escrow (sub: N órdenes), Retiros pendientes (monto + count). Montos MXN vía
  `useFormatter` (centavos ÷ 100 solo aquí).
- `withdrawals-table.tsx`: `data-table` — negocio, monto (Geist Mono), banco + `••••` +
  últimos 4, solicitado (fecha relativa), `status-badge` (Pendiente ámbar / Aprobado
  verde / Rechazado gris) y `withdrawal-row-actions`. Fila de negocio suspendido:
  `opacity` reducida, sin acciones, nota "Cuenta suspendida". Filtro por estado
  (`search-filter-bar`/Select) + "Cargar más" con cursor.
- `withdrawal-row-actions.tsx` (solo filas REQUESTED de negocio no suspendido):
  - Aprobar → `confirm-dialog` con monto y cuenta destino ("Aprobar retiro de $8,500.00
    a BBVA ••••2210") → `admin.finance.approveWithdrawal`.
  - Rechazar → `AlertDialog` con `Textarea` de razón obligatoria (min 5) →
    `rejectWithdrawal`.
- `use-withdrawal-mutations.ts`: mutations + toasts por código (`CONFLICT`,
  `STRIPE_ERROR`) e invalidación de `admin.finance.getKpis` y `listWithdrawals`.
- Todo el bloque de acciones existe únicamente en la rama manual de `XC-08`. Si Roger elige
  payouts automáticos, W12 muestra historial/estado sincronizado sin CTAs ni hooks de
  aprobación; no conserva controles muertos del diseño.
- `platform-revenue-chart.tsx`: Recharts (wrapper `chart` de shadcn) — barras/áreas
  mensuales de `series` (comisiones vs. suscripciones), leyenda y tooltip con montos
  formateados; eje X con mes corto localizado (next-intl).
- `revenue-breakdown-list.tsx`: totales del periodo — Comisiones, Suscripciones y
  "Bonos de lealtad pagados" en **negativo** (signo y color destructivo), más ingreso
  neto y nota de bonos pendientes. Todos salen de registros `LoyaltyBonus`; nunca de una
  estimación por órdenes — copy traducido.
- `finance-view.tsx` orquesta; `page.tsx` composición delgada con prefetch.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- UI → cliente tRPC; ningún agregado calculado en cliente (la gráfica solo pinta la serie
  del server).
- TypeScript estricto: sin `any`; tipos desde `finance.types.ts`.
- Identificadores en inglés; copy vía next-intl (es/en).
- Dinero en centavos en el wire; formateo MXN solo en UI.
- Datos bancarios: solo banco + últimos 4.
- La UI comprueba `{ result, error, status, message }` antes de acceder a datos y traduce
  por código estable, no por `message`.
- Componentización máxima en `_components/`.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Con seed: 4 KPIs con datos, tabla muestra los 2 retiros REQUESTED, el del negocio
      suspendido deshabilitado con nota.
- [ ] Aprobar retiro → confirm con monto/cuenta → fila pasa a Aprobado y KPI de
      pendientes decrementa sin recargar, **solo después** de cerrar F5-11.
- [ ] Gráfica renderiza 6 meses (meses vacíos en 0) y el breakdown muestra bonos en
      negativo desde datos reales, con ingreso neto y pendiente.
- [ ] es/en completos, incluida la nota "Cuenta suspendida".

## Comandos para Roger (si aplica)

No aplica.
