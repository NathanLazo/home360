# [F2-13] UI de órdenes `/dashboard/orders` (tabla + Sheet de detalle)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §5; `spec/00-foundations.md` §7;
  `spec/08-business-model-alignment.md` D5
- **Depende de**: F2-01, F2-04 (namespace `dashboard.orderStatus.*`), F2-11
  (serializa mensajes compartidos), F2-12, F2-14
- **Tamaño estimado**: M

## Contexto

Vista de solo lectura enlazada desde el sidebar (badge de activas) y desde "Ver todas" de
W3: tabla con filtros por estado/tipo/búsqueda, respeta `?branch=`, y Sheet de detalle al
hacer clic en una fila con timeline de estado derivado (ver F2-12 — no hay tabla de
eventos; el timeline se construye con `createdAt`, `payment.createdAt`,
`payment.releasedAt` y `status`).

## Alcance

Crear bajo `src/app/[locale]/dashboard/orders/`:

- `page.tsx` · `loading.tsx` · `error.tsx`
- `_components/orders-view.tsx`
- `_components/orders-table.tsx`
- `_components/order-filters.tsx`
- `_components/order-detail-sheet.tsx`
- `_components/order-timeline.tsx`
- `_components/order-status-badge.tsx`
- `_components/order.types.ts`
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (`dashboard.orders.*`)

Fuera de alcance: cualquier acción sobre órdenes (llegan en F3/F5).
No modificar namespaces i18n ajenos a `dashboard.orders.*` y
`dashboard.orderStatus.*`; F2-11 precede este ticket para evitar escritores simultáneos
de `dashboard.json`.

## Detalle técnico

- **`page.tsx`**: `parseBranchParam` → prefetch `order.list({ branchId })` +
  `HydrateClient` → `<OrdersView branchId={…} />`.
- **`orders-view.tsx`** (`"use client"`): filtros como estado local (estado/tipo/search
  con debounce) + `branchId` desde prop/URL; estado `selectedOrderId: string | null` que
  abre el Sheet (dispara `order.getById.useQuery` con `enabled: !!selectedOrderId`).
  Lista y detalle desempaquetan `TrpcResponse`: `response.result` alimenta componentes,
  `response.error` se traduce con `errors.<code>` y `query.error` se reserva para
  transporte.
- **`order-filters.tsx`**: `SearchFilterBar` — búsqueda (placeholder "Folio, título o
  cliente"), Select estado (7 estados + Todos, labels de `dashboard.orderStatus.*`),
  Select tipo (Servicio/Producto/Todos).
- **`orders-table.tsx`**: `DataTable` — folio (`#1042`, Geist Mono), título, tipo (icono
  o badge sutil), cliente (`?? "—"`), sucursal (`?? dashboard.home.noBranch`), monto
  (MXN, Geist Mono), estado (`order-status-badge.tsx` con el mapa completo
  `OrderStatus → variante`: PENDING gris, PAID azul, IN_PROGRESS ámbar, SHIPPING azul,
  COMPLETED verde, CANCELLED gris, DISPUTED rojo), fecha (formato relativo/corto con
  `useFormatter`). Fila completa clickeable (`role="button"`, accesible por teclado) →
  abre Sheet. Paginación "Cargar más" (mismo mecanismo elegido en F2-06).
- **`order-detail-sheet.tsx`**: Sheet derecho con: encabezado (folio + StatusBadge),
  cliente (nombre/email), sucursal, ítem (servicio o producto según `type`, con cantidad),
  montos (total, comisión si hay `payment`), método/estado de pago, link a
  `recordingUrl` si existe (abre en pestaña nueva), reseña (estrellas + comentario) si
  existe, y `order-timeline.tsx`. Añade una sección de evidencia D5: estado
  completa/incompleta de grabación, duración, galerías antes/después, notas y materiales
  (`quantity × unitPriceCents`, formateado MXN en UI). Campos ausentes muestran estado
  vacío localizado; no se inventan datos ni acciones. Skeleton interno mientras carga
  `getById`.
- **`order-timeline.tsx`**: lista vertical de hitos derivados — creada (`createdAt`),
  pago recibido (`payment.createdAt` si existe), escrow liberado (`payment.releasedAt`),
  estado terminal actual (completada/cancelada/en disputa según `status`). Solo hitos con
  fecha conocida; presentacional puro.
- **Estados**: skeleton de tabla; `EmptyState` (distinto para "sin órdenes" vs "sin
  resultados con estos filtros"); `error.tsx`.
- **i18n**: `dashboard.orders.*` (columnas, filtros, detalle, timeline) es/en; reusa
  `dashboard.orderStatus.*` creado en F2-04.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Selector de sucursal del header filtra la tabla vía `?branch=`.
- [ ] Clic/Enter en fila abre el Sheet con detalle completo y timeline coherente con el seed.
- [ ] Estados y montos replican el diseño; folios/montos en Geist Mono, `Intl` MXN.
- [ ] Sheet operable con teclado; focus visible; sin acciones de mutación.
- [ ] Evidencia D5 y materiales se muestran en solo lectura, con importes desde centavos.
- [ ] Ningún componente trata `TrpcResponse` como resultado directo.

## Comandos para Roger (si aplica)

—
