# Pendientes — decisiones abiertas del flujo de dinero

Este documento existe para que no se te olvide: son **cuatro decisiones de producto** sobre
disputas, reembolsos, retiros y cobro de suscripciones que la planeación dejó abiertas a
propósito, porque no son técnicas — son de negocio, y las tomas tú.

Ninguna impide arrancar. **F0, F1 y F2 se pueden implementar completos sin resolverlas.**
Empiezan a estorbar en F3 (pagos) y se vuelven bloqueantes en F5 (disputas y finanzas).

El detalle largo de cada una vive en `spec/tickets/*-findings.md`; aquí está lo que necesitas
para decidir.

---

## 1. ¿Qué pasa con la comisión cuando hay reembolso parcial?

**El problema**: un cliente disputa un trabajo de $1,000 y el admin resuelve devolverle $400.
La plataforma ya había cobrado $80 de comisión (8 %). ¿Sobre qué monto se queda?

**Las dos posturas, ambas escritas hoy en el repo**:

- **Comisión íntegra** (lo que asumen los tickets `F3-05` y `F5-07`): la plataforma conserva
  los $80. Argumento: el servicio de intermediación ya se prestó, y la disputa costó trabajo
  de moderación.
- **Comisión proporcional** (lo que recomienda la auditoría `XC-03`): la plataforma conserva
  $48 (8 % de los $600 que sí se cobraron). Argumento: cobrar comisión completa sobre dinero
  que se devolvió es difícil de defender frente al negocio.

**Por qué importa más de lo que parece**: con la alineación al deck, el bono de lealtad es el
50 % de la comisión. La decisión no solo mueve el ingreso de plataforma, también mueve lo que
recibe el proveedor.

**Dónde se aplica cuando decidas**: `spec/tickets/F3-05-refund-payment-service.md` y
`spec/tickets/F5-07-resolve-dispute-service.md`.

---

## 2. ¿El saldo "Disponible" es bruto o neto, y qué pasa con los pagos parcialmente reembolsados?

**El problema**: hoy la fórmula suma solo los pagos en estado `RELEASED`. Un pago que quedó
en `PARTIALLY_REFUNDED` tras una disputa **desaparece del saldo**, aunque el negocio se quedó
legítimamente con la diferencia. Es dinero real que el negocio no podría retirar.

Es la misma familia que la decisión 1: en cuanto definas la política de comisión, la fórmula
sale sola. El ticket `XC-03` ya propone la versión neta completa; falta tu visto bueno.

**Dónde se aplica**: `spec/tickets/XC-03-derived-balance-formulas.md`,
`F3-06-balances-service.md`, y los KPIs de `F2-03` y `F5-10`.

---

## 3. Retiros: ¿`Transfer` o `Payout` de Stripe?

**El problema**: son cosas distintas. `Transfer` mueve dinero de la plataforma a la cuenta
conectada del negocio; `Payout` lo saca de esa cuenta hacia el banco. El flujo de escrow ya
usa `Transfer` al liberar cada pago, así que cuando el negocio "retira", el dinero **ya está**
en su cuenta conectada: lo que corresponde es un `Payout`.

Los tickets de F3 y la auditoría `XC-08` divergen aquí, y hay una pista de que el modelo
quedó a medias: el campo se llama `Withdrawal.stripeTransferId` pero guardaría un id de
payout.

**Lo que hay que decidir de verdad**: si los payouts son **automáticos** (Stripe los programa
solo y el negocio no "solicita" nada, con lo cual la cola de aprobación del admin en W12
pierde sentido) o **manuales** (el negocio solicita, el admin aprueba, la plataforma dispara
el payout — que es lo que muestra el diseño).

**Dónde se aplica**: `F3-07-withdrawals-service.md`, `F5-11-withdrawal-approve-reject.md`.

---

## 4. ¿Cómo se cobra la suscripción del negocio?

**El más grave de los cuatro.** No existe en ninguna parte del plan un lugar donde el negocio
capture su tarjeta. Sin eso, Stripe Billing emite facturas que nadie paga: la suscripción
nunca cobra, y la prueba de mora con la tarjeta `4000…0341` es literalmente inejecutable.

**Opciones**:

- **Customer Portal de Stripe** (recomendado): un enlace y Stripe se encarga de tarjeta,
  facturas y cancelación. Es lo más barato de construir y lo más completo.
- **Stripe Elements embebido**: control total del diseño, bastante más trabajo.
- **Cobro por factura** (`send_invoice`): el negocio recibe una factura hosted y paga cuando
  quiere. Es el paliativo que hoy asume el ticket `F4-03`, y funciona, pero convierte la
  suscripción en algo que se paga a mano cada mes.

**Dónde se aplica**: `F4-03-billing-subscription-service.md` y el módulo W7 (`F4-08`…`F4-10`).

---

## Y una quinta que es un bug de diseño, no una decisión

**Onboarding de Stripe Connect**: `approveBusiness` crea una "cuenta Connect placeholder", y
el banner que invita al negocio a completar el onboarding se muestra solo cuando ese campo
está **vacío**. Resultado: el negocio nunca ve la invitación, `payoutsEnabled` se queda en
`false`, y ni liberar escrow ni aprobar retiros funcionan. El dinero entra a la plataforma y
no puede salir.

No hay que decidir nada de negocio: hay que quitar el placeholder o cambiar la condición del
banner. Está detallado en `spec/tickets/F5-findings.md` (F5-1) y se resuelve al implementar
`F5-05`.

---

## Resumen para revisar de un vistazo

| # | Decisión | Bloquea desde | Detalle |
|---|----------|---------------|---------|
| 1 | Comisión en reembolso parcial | F3 | `F5-findings.md` F5-2 |
| 2 | Fórmula del saldo disponible | F3 | `XC-03`, `F3-F4-findings.md` #2 |
| 3 | Retiros: Transfer vs. Payout, automático vs. manual | F3 | `XC-findings.md` XC-08 |
| 4 | Captura del método de pago de la suscripción | F4 | `F3-F4-findings.md` #13 |
| 5 | Placeholder de Connect (bug, no decisión) | F5 | `F5-findings.md` F5-1 |

La documentación completa del proyecto está en [`spec/`](spec/): el índice de las 8 fases en
[`spec/README.md`](spec/README.md) y los 116 tickets de implementación en
[`spec/tickets/README.md`](spec/tickets/README.md).
