# [F10] Flujos completos de venta y logística: descubrimiento, fulfillment, evidencia, stock y chat pre-venta

Origen: auditoría del ciclo diagnóstico → cotización → venta → entrega → escrow (2026-10-18) y
petición del owner de que el proceso del cliente sea "súper claro" en web y móvil. Afecta a
`home360` (API + dashboard + admin) y a `home360-app` (ticket hermano `M8`).

## Decisiones (D10-x, normativas)

| # | Decisión |
|---|---|
| D10-1 | **Fulfillment de PRODUCT**: `Order.fulfillmentMethod: FulfillmentMethod { DELIVERY, PICKUP }` (null en SERVICE). Lo elige el cliente al comprar. `PICKUP` requiere sucursal con `pickupEnabled` y coordenadas; `DELIVERY` requiere dirección. |
| D10-2 | **Evidencia por tipo**. DELIVERY: el negocio marca `OUT_FOR_DELIVERY` (opcional) y `DELIVERED` con ≥1 foto del paquete en el domicilio (`Order.deliveryEvidenceUrls`, kind `evidence`); `DELIVERED` escribe también `CONFIRMATION_REQUESTED` y arma el reloj de auto-liberación. PICKUP: el negocio marca `READY_FOR_PICKUP`; la app del cliente muestra un QR con el código de recolección; el negocio lo escanea → `order.redeemPickup` → `PICKED_UP` + `CONFIRMED` + liberación inmediata + `COMPLETED` (el cliente está presente y entrega su QR: eso es su confirmación). SERVICE: sin cambio (grabación + fotos antes/después). |
| D10-3 | **Reloj de auto-liberación** arma en `CONFIRMATION_REQUESTED` (WORK_DONE / DELIVERED), nunca en la captura. La captura deja `escrowReleaseAt = null`. `releaseDuePayments` pasa la orden a `COMPLETED` (CAS desde PAID/IN_PROGRESS/SHIPPING) en el mismo paso que escribe `AUTO_RELEASED`. |
| D10-4 | **Inventario**: `ProductStock.stock` es "disponible". Reserva atómica al crear la orden PENDING (`updateMany` con `stock >= qty`, `Order.stockHeldQty = qty`), nunca en el webhook. Restauración exactamente una vez (CAS sobre `stockHeldQty`) en cancelación impaga, cancelación con reembolso, FULL_REFUND de disputa y expiración. `OUT_OF_STOCK` como código estable. `adjustStock` recibe deltas con precondición (`expectedStock`) o rechaza con `CONFLICT`. |
| D10-5 | **Expiración**: cron `expire-unpaid-orders` (cada 15 min) cancela órdenes PENDING con más de `PlatformSettings.unpaidOrderTtlMinutes` (30) → `CANCELLED` + evento `PAYMENT_EXPIRED` + restaura stock + reabre request/quotes como el cancel del cliente. `ServiceRequest.expiresAt` se escribe en `request.create` (`requestTtlHours`, 72); `quote.accept` lo valida. |
| D10-6 | **Sucursal**: DELIVERY → sucursal ACTIVE más cercana a la dirección con stock suficiente; PICKUP → la que eligió el cliente (validada). El catálogo expone disponibilidad por sucursal, nunca la suma cruda. |
| D10-7 | **Reintento de pago de PRODUCT**: `createProductIntent` es idempotente (reutiliza la orden PENDING del cliente para el mismo producto/cantidad/fulfillment) y devuelve `orderId`; `checkout.createIntent({ orderId })` acepta PRODUCT. |
| D10-8 | **PRODUCT solo confirma tras entrega**: `awaitingConfirmation = isAwaitingConfirmation(events)` para ambos tipos; `confirmDelivery` lo exige para PRODUCT también. |
| D10-9 | **Cancelaciones coherentes**: el negocio que cancela una orden PAID reabre la request y las cotizaciones hermanas como el flujo del cliente. El cliente puede cancelar una orden PAID antes de que empiece el trabajo (SERVICE sin `EN_ROUTE`; PRODUCT sin `ACCEPTED`) con reembolso total y restauración de stock. |
| D10-10 | **Descubrimiento**: `marketplace.listBusinesses` (activos; distancia a la dirección predeterminada o a `lat/lng`; filtros `category`, `kind`), `marketplace.getBusiness` (perfil público + servicios ACTIVE + productos PUBLISHED con disponibilidad + sucursales con `pickupEnabled`) y `marketplace.getService`. Toda fila de catálogo lleva `businessId`. |
| D10-11 | **Solicitud dirigida**: `request.create` acepta `businessId` + `serviceId` opcionales → `ServiceRequest.targetBusinessId/targetServiceId`. El radar la muestra solo a ese negocio (sin filtro de categoría ni radio); `notifyNearbyBusinesses` solo lo notifica a él. |
| D10-12 | **Chat pre-venta**: conversación de consulta cliente×negocio (`Conversation.customerId`, `productId?`, `@@unique([businessId, customerId])`) vía `messaging.getOrCreateInquiry`. El cliente puede abrir la conversación de una cotización (`businessId` viaja en `quote.*`). El negocio sigue pudiendo escribir tras cotizar. |
| D10-13 | **Lecturas del cliente**: `request.listMine` devuelve `pendingQuoteCount`, `acceptedOrderId`, `targetBusiness`, miniatura firmada y estado; `quote.listByRequest` acepta `status` (default PENDING) y expone `businessId`, `conversationId`; `quote.getById` expone `businessId`, `requestId`, `orderId`. |
| D10-14 | **Admin**: `admin.orders.list` + `admin.orders.getById` (todo tipo, evidencia, fulfillment, timeline) y página `admin/orders`. |
| D10-15 | **Notificaciones** nuevas: `quoteAccepted` (negocio), `productAccepted`, `orderReadyForPickup`, `orderOutForDelivery`, `orderDelivered` (cliente), `orderPaymentExpired` (ambos). |

## Delta de schema (Prisma)

```prisma
enum FulfillmentMethod { DELIVERY PICKUP }
enum OrderEventType { …, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED, PICKED_UP, PAYMENT_EXPIRED }

model Branch { pickupEnabled Boolean @default(true); deliveryEnabled Boolean @default(true) }
model Order {
  fulfillmentMethod    FulfillmentMethod?
  deliveryEvidenceUrls String[]
  deliveryNote         String?
  pickupCodeHash       String?   @unique   // SHA-256 del código; plaintext derivado por HMAC(secret, order.id)
  pickedUpAt           DateTime?
  stockHeldQty         Int       @default(0)
}
model ServiceRequest { targetBusinessId String?; targetBusiness Business? …; targetServiceId String?; @@index([targetBusinessId, status]) }
model Conversation { customerId String?; customer User? …; productId String?; @@unique([businessId, customerId]) }
model PlatformSettings { unpaidOrderTtlMinutes Int @default(30); requestTtlHours Int @default(72) }
```

## Procedures (contrato para móvil y web)

| Router | Procedure | Rol | Input → Result |
|---|---|---|---|
| marketplace | `listBusinesses` | user | `{ cursor?, category?, kind?: "service"\|"product", lat?, lng? }` → `{ items: { id, name, type, guaranteeType, ratingAvg, ratingCount, distanceKm\|null, categories[], coverUrl\|null, servicesCount, productsCount }[], nextCursor }` |
| marketplace | `getBusiness` | user | `{ id }` → `{ id, name, type, guaranteeType, guaranteeNotes, ratingAvg, ratingCount, branches: { id, name, address, latitude, longitude, pickupEnabled, distanceKm }[], services: { id, name, category, basePriceCents, durationMinutes }[], products: { id, name, category, priceCents, imageUrl, available, lowStock }[] }` |
| marketplace | `getService` | user | `{ id }` → servicio + `business { id, name, ratingAvg }` |
| marketplace | `getProduct` | user | añade `businessId`, `available` (máx. por sucursal elegible), `lowStock`, `fulfillment: { delivery: boolean, pickupBranches: { id, name, address, distanceKm }[] }` |
| marketplace | `listFeaturedProducts` / `search` | user | añaden `businessId` |
| checkout | `createProductIntent` | user | `{ productId, quantity, fulfillmentMethod, addressId? (DELIVERY), branchId? (PICKUP) }` → `{ orderId, clientSecret, … }`; códigos `OUT_OF_STOCK`, `PICKUP_NOT_AVAILABLE`, `DELIVERY_NOT_AVAILABLE` |
| checkout | `createIntent` | user | acepta PRODUCT |
| request | `create` | consumer | + `businessId?`, `serviceId?` |
| request | `listMine` | consumer | items enriquecidos (D10-13) |
| quote | `listByRequest` | consumer | + `status?`; items con `businessId`, `conversationId` |
| quote | `getById` | consumer | + `businessId`, `requestId`, `orderId` |
| order | `markOutForDelivery({ id })` · `markDelivered({ id, evidencePathnames[1..10], note? })` · `markReadyForPickup({ id })` · `redeemPickup({ code })` | activeBusiness | eventos D10-2; `PICKUP_CODE_INVALID`, `FULFILLMENT_MISMATCH` |
| order | `getById` | business | + `fulfillmentMethod`, `deliveryEvidence[]`, `deliveryLatitude/Longitude`, `actions: { acceptProduct, markOutForDelivery, markDelivered, markReadyForPickup, redeemPickup, assignWorker, cancel }` |
| tracking | `getOrder` | consumer | + `fulfillmentMethod`, `pickupCode` (solo si `READY_FOR_PICKUP` y sin `PICKED_UP`), `deliveryEvidence[]`, `pickupBranch`, `actions.canShowPickupQr`, `actions.canCancelPaid` |
| tracking | `cancelOrder` | consumer | acepta PAID según D10-9 |
| messaging | `getOrCreateInquiry({ businessId, productId? })` | consumer | conversación de consulta |
| messaging | `getOrCreateForRequest` | consumer + business | sin cambio de firma; `businessId` ahora llega desde `quote.*` |
| admin.orders | `list` / `getById` | admin | D10-14 |
| cron | `expire-unpaid-orders` | – | D10-5 (`vercel.json`) |

## Verificación

`pnpm typecheck`, `pnpm check`, `pnpm build` (sin DB). Schema: el owner aplica `pnpm db:push`
(decisión vigente en `P-WEB-03`). Códigos nuevos en `errors.json` es/en.
