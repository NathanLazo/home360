# F13 — Diagnóstico inicial y cargo final (servicios cotizados después de la visita)

## Problema

Algunos servicios no se pueden cotizar hasta que el técnico ve el trabajo (p. ej.
una instalación). El negocio cobra un **diagnóstico** antes y emite el **precio final**
después de la visita. El catálogo ya guardaba `Service.diagnosticPriceCents` y
`diagnosticCredited`, pero ningún flujo los cobraba.

## Decisiones

- **Configuración por servicio** (ya existía en W5 Servicios): activar diagnóstico,
  precio y si **se abona** al precio final.
- **La oferta copia los términos**: `Quote.serviceId` + `diagnosticPriceCents` /
  `diagnosticCredited` se guardan al enviar la oferta. Un cambio posterior en el
  catálogo no altera una oferta que el cliente ya vio. `Quote.amountCents` pasa a ser el
  **precio estimado** del trabajo.
- **Dos órdenes y un solo escrow por orden** (no se reabre D1–D8 ni `PENDIENTES.md`):
  1. Aceptar la oferta crea la orden de diagnóstico (`Order.isDiagnostic`,
     `amountCents = diagnóstico`). Se paga y libera con el ciclo normal.
  2. Ya iniciada la visita (`IN_PROGRESS` o `COMPLETED`, sin disputa), el negocio usa
     `order.issueFinalCharge` para crear la orden de seguimiento (`diagnosticOrderId`)
     por `final − abono` (o `final` si no se abona). El cliente la paga con
     `checkout.createIntent` antes de la instalación y sigue el flujo normal de
     evidencia → liberación.
- Si el cargo final queda `CANCELLED` (p. ej. expiró sin pagarse), se puede volver a
  emitir. Solo puede haber un cargo final activo.
- El precio final debe ser **mayor que el abono** (`FINAL_CHARGE_BELOW_CREDIT`).
- Cada orden lleva su propia `customerServiceFeeCents` y su propia comisión.

## Superficie

| Capa | Cambio |
|------|--------|
| Prisma | `Quote.serviceId/diagnosticPriceCents/diagnosticCredited`; `Order.isDiagnostic/diagnosticOrderId/diagnosticCreditCents` |
| tRPC | `quote.submit({ serviceId? })`, `service.listQuotable`, `order.issueFinalCharge` |
| Lectura | `quote.listByRequest/getById.diagnostic`, `order.getById.diagnostic` + `actions.issueFinalCharge`, `order.list.stage`, detalle consumer `diagnostic` |
| Push | `finalChargeIssued` al cliente |
| Errores | `DIAGNOSTIC_NOT_READY`, `FINAL_CHARGE_EXISTS`, `FINAL_CHARGE_BELOW_CREDIT` |
| Web | Servicio en el formulario de oferta con aviso de cobro en dos pasos; sección "Diagnóstico" y acción "Emitir cargo final" en el detalle de la orden; insignia de etapa en la tabla |

## Pendiente (app móvil, `home360-app`)

- C4/C5: mostrar `diagnostic` en la oferta (paga hoy el diagnóstico; se abona o no).
- Detalle de orden: enlazar diagnóstico ↔ cargo final y mostrar el abono aplicado.
- Técnico: acción "Emitir cargo final" con `order.issueFinalCharge`.
