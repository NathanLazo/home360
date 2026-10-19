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

## Correcciones del review (backend, 2026-10-19)

Review de `b1d9070`. Cada hallazgo y su corrección:

| # | Corrección |
|---|---|
| H1 | `Order.checkoutSessionId String? @unique`: lo guarda `createOrderCheckoutSession` (CAS sobre PENDING; si la orden ya cerró, la sesión se expira). El cron, el cancel del cliente y el del negocio llaman `stripe.checkout.sessions.expire` **antes** de cerrar y fuera de la tx; una sesión `complete` se salta (el webhook la captura). Defensa en profundidad: `capturePayment` responde `ORDER_NOT_PAYABLE` (antes del guard de pago distinto) a toda captura sobre una orden no PENDING, y el webhook reembolsa el cargo completo (idempotency key `refund-unpayable-order-<pi>`). Nunca se crea un `IN_ESCROW` huérfano. |
| M1 | `reopenRequestAfterCancel` solo revive cotizaciones hermanas con `order: { is: null }`. |
| M2 | `closePendingOrder` borra los Payment PENDING **por `orderId`** y devuelve sus intents; el llamador los anula después de la tx (`voidIntentsAfterClose`). `createIntent` / `createProductIntent` / la Checkout Session responden `ORDER_EXPIRED` (409) pasado `unpaidOrderTtlMinutes`; `canPay` respeta el TTL. El alta del Payment toma el lock de la orden con un CAS sobre PENDING. |
| M3 | `Order.expiryAttemptedAt DateTime?`: el cron lo sella antes de tocar Stripe, ordena nulls-first y salta filas intentadas en los últimos 15 min (patrón de `escrowReleaseAttemptedAt`). Lote de 50, presupuesto de 40 s; `hasMore` indica que otra corrida debe continuar. |
| M4 | Máx. **3** órdenes PRODUCT PENDING por cliente (`MAX_OPEN_PRODUCT_ORDERS_PER_CUSTOMER`). Dentro de la misma tx Serializable de la reserva, la nueva orden reemplaza a la más antigua: `closePendingOrder` (evento CANCELLED del cliente, stock liberado con motivo `REPLACED_BY_NEWER_CHECKOUT`); sus intents se anulan tras la tx. Un intent que ya llevaba dinero termina en reembolso automático (H1). |
| M5 | `markDelivered` verifica cada pathname con `head()` del blob antes de la tx (almacenamiento sin configurar falla cerrado) y rechaza duplicados; dentro de la tx rechaza pathnames ya presentes en `deliveryEvidenceUrls`/`beforeUrls`/`afterUrls` de cualquier orden → `EVIDENCE_REUSED` (409). |
| M6 | El cancel PAID solo vuelve a `PAID` si el pago sigue `IN_ESCROW`; en `REFUNDING` el cancel se mantiene (`refunded: false`) y lo termina `charge.refunded` o el barrido del cron. `acceptProductOrder` y el `EN_ROUTE` del worker exigen `payment.status = IN_ESCROW` en su CAS. |
| L1 | `DELIVERED` y `PICKED_UP` ponen `stockHeldQty = 0` sin devolver unidades (`consumeHeldStock`). FULL_REFUND restaura solo si no hubo entrega; cualquier otra resolución consume la reserva. |
| L2 | El evento CANCELLED del cancel PAID va dentro de la tx de restore/reopen. El cron reconcilia `CANCELLED ∧ stockHeldQty > 0` (y `CANCELLED ∧ payment REFUNDING`, reintento del reembolso con la misma key) tras 10 min de gracia, escribiendo el CANCELLED faltante. |
| L3 | Una liberación de recolección diferida que completa el cron se registra como `CONFIRMED` (actor: quien canjeó), no `AUTO_RELEASED`, y sin push de auto-liberación. `*/15` del cron de expiración requiere plan Vercel Pro (Hobby solo permite crons diarios). |
| L4 | El límite de canje cuenta solo códigos desconocidos (`PICKUP_CODE_INVALID`); CONFLICT y éxito liberan el intento. Clave por cajero × negocio. |
| L5 | `marketplace.getBusiness`: dirección y coordenadas exactas solo de sucursales `pickupEnabled`; el resto `address: null`, coordenadas redondeadas (~110 m, mismo helper que el radar) y `exactLocation: false`; la distancia se calcula sobre el punto publicado. |
| L6 | `marketplaceBusinessWhere` (ACTIVE y suscripción existente no CANCELED, la regla de `activeBusinessProcedure`) en listBusinesses, getBusiness, getService, getProduct, destacados, búsqueda, sugerencias, solicitud dirigida, `createProductIntent` y el reintento de `createIntent`. |
| L7 | `createIntent({ orderId })` de PRODUCT revalida producto PUBLISHED y negocio visible (si no, `NOT_FOUND`). |
| L8 | DELIVERY re-rankea las sucursales con el stock leído dentro de la tx y cae a la siguiente candidata cuando una reserva pierde la carrera. |
| L10 | `maxDuration = 60` en la ruta del cron; cada llamada a Stripe del cron con timeout de 8 s. |

## F10-b — Ledger de stock

`StockMovement { id, productId, branchId, type, quantity (con signo), stockAfter, orderId?, actorUserId?, reason?, createdAt }`,
relaciones Product/Branch (Cascade), Order y actor User (SetNull); índices `[productId, branchId, createdAt]`, `[orderId]`,
`[branchId, createdAt]`, `[actorUserId]`. Append-only (sin `updatedAt`).

Semántica (normativa):

- `ProductStock.stock` es **disponible**. Cada cambio de `ProductStock` escribe su fila de movimiento **en la misma
  transacción**; `stockAfter` es el valor leído en esa tx.
- `RESERVE (−qty)`: al crear la orden PRODUCT PENDING (`createProductIntent`), con `orderId` y el cliente como actor.
- `RELEASE (+qty)`: cada restauración (`restoreHeldStock`: cancel impago, cancel con reembolso, FULL_REFUND antes de la
  entrega, expiración, reemplazo M4, reconciliación del cron). `reason` = `CANCELLED`, `PAYMENT_EXPIRED`,
  `CANCELLED_WITH_REFUND`, `DISPUTE_FULL_REFUND`, `REPLACED_BY_NEWER_CHECKOUT`, `CANCEL_RECONCILED`.
- `ADJUST (±delta)`: ediciones del negocio (formulario, `adjustStock`, alta de producto, importación CSV, sucursal
  retirada del producto) con el usuario como actor; `reason` = `STOCK_EDIT`, `PRODUCT_CREATED`, `CSV_IMPORT`,
  `BRANCH_REMOVED`. Deltas cero no se registran.
- `RESTOCK (+qty)`: reservado para una futura acción "reingresar tras reembolso". Una entrega (DELIVERED/PICKED_UP) no
  mueve stock: las unidades ya salieron con el RESERVE.

Lecturas: `product.listStockMovements({ productId, branchId?, cursor? })` (`businessProcedure`, alcance por negocio en
el `where`; 20 por página, más reciente primero) → `{ items: { id, type, quantity, stockAfter, branchId, branchName,
orderId, orderFolio, actorName, reason, createdAt (ISO) }[], nextCursor }`; `admin.orders.getById` añade
`stockMovements` (últimos 20 del producto/sucursal de la orden).

## Pendientes

- **L9 — órdenes PRODUCT PENDING heredadas**: las creadas antes de F10 tienen `stockHeldQty = 0` y
  `fulfillmentMethod = null`; si se pagan tras el deploy nunca descuentan stock. Migración única: expirarlas (o reservar
  su stock) antes de activar F10 en producción.
- **L11 — recolecciones no recogidas**: una orden en READY_FOR_PICKUP retiene el escrow indefinidamente; definir un
  vencimiento (p. ej. N días → reembolso + RELEASE) en lugar de obligar a una disputa.
- Evidencia SERVICE (fotos antes/después del worker): misma verificación `head()` + no reutilización que M5.
- `RESTOCK`: acción del negocio para reingresar unidades devueltas tras un reembolso.
