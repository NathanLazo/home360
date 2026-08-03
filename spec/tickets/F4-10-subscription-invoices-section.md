# [F4-10] W7 sección de facturas: última factura, listado y descarga

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §4 (`listInvoices`), §5 (`invoices-section.tsx`), §criterios
- **Depende de**: `F4-05` (sincronización de facturas), `F4-06` (`listInvoices`),
  `F4-08` (vista de W7), `F4-09` (serializa cambios a `subscription-view.tsx`)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Cierra W7 con la sección de facturación del diseño: "Última factura: $999 · 15 jul ·
pagada" y el acceso a las facturas anteriores con su PDF de Stripe. Las filas provienen del
modelo `Invoice` local, poblado por los eventos de factura de F4-05.

**Problemas detectados en la spec, resueltos aquí:**

1. `Invoice.pdfUrl` es opcional (F0 §3) pero el criterio de aceptación dice "facturas
   descargables desde `pdfUrl`". **Resolución**: sin `pdfUrl` (factura aún no finalizada
   por Stripe) el botón se muestra deshabilitado con tooltip, nunca un link roto.
2. La spec dice "Descargar facturas" en plural sin definir el gesto. **Resolución**: no hay
   descarga masiva (Stripe no ofrece un ZIP); el botón principal descarga la **última**
   factura y la lista ofrece una descarga por fila.
3. Un negocio recién aprobado no tiene facturas. **Resolución**: `empty-state.tsx` (F0) con
   copy propio, no una tabla vacía.
4. `pdfUrl` sirve para descargar el documento, **no para pagar** una factura ni administrar
   la suscripción. `hosted_invoice_url` no está modelado y depende de la política de cobro;
   esta UI no presenta el PDF como CTA de regularización.

## Alcance

Crear:

- `src/app/[locale]/dashboard/subscription/_components/invoices-section.tsx`
- `src/app/[locale]/dashboard/subscription/_components/latest-invoice-summary.tsx`
- `src/app/[locale]/dashboard/subscription/_components/invoice-list.tsx`
- `src/app/[locale]/dashboard/subscription/_components/invoice-status-badge.tsx`

Modificar:

- `src/app/[locale]/dashboard/subscription/_components/subscription-view.tsx` (montar la sección)
- `src/messages/{es,en}/dashboard.json`

Fuera de alcance: facturación fiscal mexicana / CFDI (ninguna spec la cubre, ver
`F3-F4-findings.md` #19); router y servicios.

## Detalle técnico

- `invoices-section.tsx`: `api.subscription.listInvoices.useInfiniteQuery({}, { getNextPageParam })`;
  cada página desempaqueta `page.result`; `page.error` se traduce y no se interpreta como
  lista vacía. Los errores de transporte se manejan aparte.
  compone `latest-invoice-summary.tsx` (primer item) + `invoice-list.tsx` (el resto) +
  botón "Cargar más" con `nextCursor`. Sin items → `empty-state.tsx`.
- `latest-invoice-summary.tsx`: "{monto} · {fecha} · {estado}" con
  `useFormatter().dateTime` y `cents / 100` formateado como MXN (única división permitida)
  + botón primario "Descargar" (`<a href={pdfUrl} target="_blank" rel="noopener noreferrer">`).
- `invoice-list.tsx`: filas con fecha, monto (Geist Mono), `invoice-status-badge.tsx` y
  acción de descarga por fila. Usa `data-table.tsx` (F0) si la forma encaja; si no, una
  lista simple — no inventar una tabla paralela.
- `invoice-status-badge.tsx`: mapa **tipado por unión** sobre los 3 valores de
  `InvoiceStatus` (F0 §3, patrón `status-badge.tsx`): `PAID` verde ("Pagada"), `OPEN` ámbar
  ("Pendiente/no pagada", cubre también `uncollectible` por la limitación documentada en
  F4-05), `VOID` gris ("Anulada"). Sin `default`.
- Fechas: `issuedAt` viene del servidor; el cliente solo formatea por locale.
- i18n (es/en): `dashboard.subscription.invoices.title`, `…latest`, `…download`,
  `…noPdf`, `…loadMore`, `…empty.title`, `…empty.description`,
  `…status.{paid,open,void}`.

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
- [ ] "Última factura: $999 · 15 jul · pagada" replica el diseño en es/en.
- [ ] La descarga abre el `pdfUrl` de Stripe en pestaña nueva; sin `pdfUrl` → botón
      deshabilitado, nunca link roto.
- [ ] Paginación por cursor funcional; estado vacío presente.
- [ ] Badge cubre los 3 valores de `InvoiceStatus` sin `default`.
- [ ] El PDF nunca se presenta como medio de pago/Portal y el envelope se desempaqueta.

## Comandos para Roger (si aplica)

Para generar facturas reales en test-mode: con `stripe listen` activo, pagar la factura
hosted de la suscripción (o usar un test clock para avanzar un ciclo).
