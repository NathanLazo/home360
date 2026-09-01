# [P-WEB-02] Completar contratos aditivos requeridos por mobile

## Trabajo pendiente

- `order.list`: aceptar `workerId?`, validar tenancy y filtrar solo órdenes del negocio.
- `auth.me` para WORKER: incluir `specialty`, negocio y sucursal mínima (`id`, `name`).
- `radar.getRequest`: devolver la cotización propia del negocio, si existe, para soportar
  retirar/reanudar una oferta sin inferencias del cliente.
- `quote.submit`: decidir y aplicar la transición `ServiceRequest.OPEN → QUOTED`; mantener
  `QUOTED` mientras haya al menos una oferta activa y documentar qué ocurre al retirar la
  última.
- Añadir `review.create` customer-only: orden completada y propia, una review por orden,
  rating validado y actualización consistente de agregados del negocio/trabajador.
- Mantener el sobre `TrpcResponse`, selects mínimos, ownership en servidor y traducciones
  es/en de cualquier código nuevo.

## Aceptación

- N2 puede distinguir solicitud sin oferta, cotizada y retirada.
- N5 consulta las órdenes del trabajador seleccionado sin filtrar en el cliente.
- T4 obtiene specialty/sucursal sin otra consulta privilegiada.
- La confirmación C6 puede enviar una calificación una sola vez.
- `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

