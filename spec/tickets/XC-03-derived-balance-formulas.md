# [XC-03] Definir fórmulas exactas (netas) de los saldos derivados

> Ticket transversal (pre-F0). Nace del hallazgo XC-03 de `spec/tickets/XC-findings.md`.

## Metadatos

- **Fase**: XC — corrección transversal de specs (aplicar antes de ejecutar F0/F3)
- **Spec origen**: `spec/03-payments.md` §1, §7 · `spec/02-business-dashboard.md` §1 ·
  `spec/05-admin.md` §3, §4
- **Depende de**: decisión 1 y decisión 2 de `PENDIENTES.md` resueltas por Roger
- **Tamaño estimado**: S

## Contexto

F3 §1 define "Disponible = Σ `RELEASED` − Σ retiros `APPROVED|REQUESTED`" sin decir si la
suma es bruta o neta de comisión, y F5 §3 introduce pagos `PARTIALLY_REFUNDED` cuyo resto
"se libera" al negocio pero nunca entra a "Σ `RELEASED`": tras cualquier disputa parcial,
dinero transferido queda invisible e irretirable. F2 §1 (revenue W3) tiene el mismo hueco.
Las fórmulas no pueden cerrarse todavía: `PENDIENTES.md` mantiene abiertas tanto la política
de comisión del reembolso parcial como la semántica exacta de "Disponible". Este ticket es
el único punto de propagación una vez que Roger elija; **no autoriza escoger por él**.

## Alcance

- `spec/03-payments.md` §1 (bloque "Saldos derivados") y §7 (verificación manual).
- `spec/02-business-dashboard.md` §1 (definición de revenue de `getKpis`/`getWeeklyRevenue`).
- `spec/05-admin.md` §3–§4 (resoluciones y agregados financieros).
- Tickets consumidores a reconciliar por el coordinador: `F2-03`, `F3-04`, `F3-05`,
  `F3-06`, `F5-07`, `F5-10` y `F5-16`.
- Fuera de alcance: código; cambios de schema (los campos ya existen).

## Detalle técnico

Tras documentarse la decisión, reemplazar en `spec/03-payments.md` §1 el bloque de saldos
por una de estas dos ramas completas; nunca mezclar una fórmula de una rama con la otra.

Base común:

```text
providerNetCents(p) = monto proveedor no reembolsado − comisión retenida

- Disponible      = Σ providerNetCents(p) para p.status ∈ {RELEASED, PARTIALLY_REFUNDED}
                    − Σ w.amountCents para w.status ∈ {REQUESTED, APPROVED}
- En escrow       = Σ p.amountCents para p.status = IN_ESCROW
- Comisión del mes = Σ comisión efectivamente retenida de pagos del mes
```

- **Rama A — comisión íntegra**: `commissionCents` permanece congelada; el reembolso parcial
  no puede exceder el monto del proveedor menos la comisión y el bono D3 se calcula sobre
  esa comisión íntegra.
- **Rama B — comisión proporcional**: persistir la comisión efectivamente retenida tras el
  reembolso, recalcular el bono D3 sobre esa comisión y dejar trazable la comisión original
  si la auditoría histórica la necesita.

En ambas ramas, `providerNetCents` debe excluir la tarifa plana D2; `XC-25` define la
descomposición canónica del pago para que la tarifa de servicio nunca aparezca como saldo
retirable del proveedor.

En `spec/02-business-dashboard.md` §1: "revenue = Σ (amountCents − refundedCents) de
pagos `IN_ESCROW|RELEASED|PARTIALLY_REFUNDED` del periodo", aplicado sobre el monto del
proveedor, no sobre la tarifa de servicio D2.

En `spec/03-payments.md` §7, dejar escrita la invariante a verificar a mano: "un pago
PARTIALLY_REFUNDED aporta su neto al disponible; el disponible nunca incluye comisiones".

En `spec/05-admin.md` §3, nota al pie de la tabla: "el efecto monetario usa las fórmulas
netas de F3 §1".

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Dinero en centavos (Int); saldos siempre derivados en servidor, jamás columna persistida.
- TypeScript estricto: sin `any`, sin `@ts-ignore`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] Las tres specs citan la **misma** definición de neto y los mismos conjuntos de
      estados; ninguna fórmula queda en términos de "Σ RELEASED" a secas.
- [ ] La política de comisión ante refund parcial cita la decisión de Roger y no conserva
      texto provisional contradictorio en `F3-05`/`F5-07`.
- [ ] La verificación manual de F3 §7 cubre `PARTIALLY_REFUNDED`; no se crean tests.
- [ ] El devengo D3 en reembolso parcial usa la misma comisión efectivamente retenida que
      W12 y el saldo disponible.

## Comandos para Roger (si aplica)

—
