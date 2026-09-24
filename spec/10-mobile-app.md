# Plan — HOME360 App Móvil (Expo) + API web para mobile

## Contexto

El plan spec de la web (F0–F7) está completo. Sigue el desarrollo de la app móvil según
`design/HOME360-App-Movil.dc.html`: **una sola app con 3 modos por rol** — Cliente (C1–C6),
Negocio (N1–N7) y Trabajador (T1–T4), 17 pantallas. La app consume el mismo `appRouter` de
tRPC de la web (`spec/README.md`), pero hoy el backend solo tiene **un** endpoint customer
(`payment.confirmDelivery`) y ningún guard WORKER: **el plan incluye el desarrollo de la API
en la web** además de la app. El repo móvil (`C:\Users\roger\projects\home360-app`) es un
scaffold Expo SDK 57 sin tocar (expo-router + native tabs, React 19, sin data layer, auth,
i18n ni tokens). Durante la implementación se usan las **skills vendorizadas de Expo**
(`.agents/skills/`): expo-project-structure, expo-router, expo-native-ui, expo-data-fetching,
expo-tailwind-setup, expo-dev-client, eas-*.

## Decisiones tomadas (con Roger)

| Tema | Decisión |
|---|---|
| Realtime (chat + tracking) | **Pusher** (Channels) desde M4 para el chat humano cliente↔negocio/técnico; push nativas **APNs/FCM vía expo-notifications** como complemento en background. **No hay chatbot IA**: la IA solo corre en el backend analizando la imagen para el diagnóstico |
| Media (fotos, evidencia, grabaciones) | **Vercel Blob** (privado) con URLs de subida directa desde la app |
| IA visión (diagnóstico C2/C3) | **Grok 4.7** (`spacexai/grok-4.7`, mismo catálogo que el asistente) vía Vercel AI SDK a través del **Vercel AI Gateway** (model string + `AI_GATEWAY_API_KEY`, sin paquetes de provider; `generateObject` + schema Zod), config desde `PlatformSettings` |
| Styling móvil | **NativeWind + Tailwind** (skill `expo-tailwind-setup`), tokens zinc del diseño |
| Auth móvil | Endpoints `POST /api/mobile/auth/*` que emiten el **mismo JWT de NextAuth** (`next-auth/jwt` encode, mismo `AUTH_SECRET`); la app lo guarda en `expo-secure-store` y lo manda como `Authorization: Bearer`. `createTRPCContext` hace fallback de cookie → Bearer respetando `authInvalidated`. Google nativo vía `expo-auth-session` → `id_token` verificado en `/api/mobile/auth/google` |
| Tipos compartidos | Repos separados; alias type-only `@home360/api` → `../home360/src/server/api/root.ts` solo para `type AppRouter`/`TrpcResponse` (Metro nunca lo resuelve; EAS no depende del repo hermano) |
| Overlay grabación T2 | Timestamp+geo como overlay de UI + sidecar `RecordingSegment` firmado por el server (no se quema en el video) |
| i18n móvil | `use-intl` (núcleo de next-intl, corre en RN); es default, en secundario; reutiliza formato de mensajes de la web |

Convenciones web que aplican a todo: routers delgados → servicios en `src/server/services/`,
contrato `TrpcResponse` vía `ok()/fail()` de `src/server/api/contract.ts`, dinero en centavos
Int MXN, tenant desde sesión, códigos nuevos en `DOMAIN_ERROR_CODES` + `errors.json` es/en.
Estética móvil: DESIGN-DIRECTIVE §7 (personalidad Corporate zinc: sin animaciones de entrada,
motion solo feedback, 4 estados por pantalla, AA, reduced-motion), Geist/Geist Mono, Lucide.

## Migraciones Prisma (las corre Roger; 3 tandas)

- **A (antes de M1)**: `PushToken` (userId, expoToken único, platform), `CustomerProfile`
  (userId único, stripeCustomerId, defaultPaymentMethodId), `Address` (userId, label, línea,
  lat/lng, isDefault).
- **B (antes de M3/M4)**: `Conversation` (orderId/requestId) + `Message` (sender, type
  TEXT/IMAGE/LOCATION, body, attachmentUrl, lat/lng, readAt) — levanta la decisión D5;
  `OrderEvent` (type ACCEPTED/ESCROW_HELD/EN_ROUTE/ARRIVED/RECORDING_STARTED/…/CONFIRMED/
  AUTO_RELEASED) — timeline C6 sin tocar el enum `OrderStatus`; `Worker.lastLatitude/
  lastLongitude/locationUpdatedAt`.
- **C (antes de M6)**: `RecordingSegment` (orderId, startedAt/endedAt, geo inicio/fin,
  uploadedAt, interrupted) — sidecar de T2; interrupción sin justificar mapea al código
  `RECORDING_JUSTIFICATION_REQUIRED` existente.

## Fases

Dependencias: M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 (M6 necesita cotizaciones de M5 para
tener órdenes asignadas).

### M0 — Fundaciones (API mobile-ready + esqueleto app, sin pantallas)

**Web** (`home360`):
- `src/server/auth/mobile-token.ts` (issue/verify JWT reutilizando `authorize` de
  `src/server/auth/config.ts` y rate limiting `AuthAttempt`); route handlers
  `src/app/api/mobile/auth/{login,google,refresh}/route.ts`.
- `src/server/api/trpc.ts`: fallback Bearer en `createTRPCContext` + **`workerProcedure`**
  (rol WORKER → resuelve `Worker` por userId → `ctx.worker {id, businessId, branchId,
  availability}`).
- Router `media.ts` + `src/server/services/media/` : URLs de subida a Vercel Blob por tipo
  (requestPhoto, evidence, recording, chatAttachment), keys por tenant. Env en `src/env.js`.
- Migración A (Roger).

**Móvil** (`home360-app`) — skills `expo-project-structure`, `expo-tailwind-setup`, `expo-data-fetching`:
- Estructura `src/{app,components/ui,features,lib,theme,i18n}`; deps: `@trpc/client`,
  `@tanstack/react-query`, `superjson`, `expo-secure-store`, `use-intl`, NativeWind,
  `lucide-react-native`, `react-native-svg`, fuentes Geist (`expo-font`).
- `src/lib/api.ts`: cliente tRPC (httpBatchLink → `/api/trpc`, Bearer desde secure-store,
  superjson) + `unwrap()` del `TrpcResponse` + mapa códigos de error → i18n.
- Tokens zinc en `src/theme/` + config NativeWind; i18n es/en; componentes base con 4 estados
  (`Screen`, `Button`, `Card`, `EmptyState`, `ErrorState`, `Skeleton`).
- `eas.json` + `expo-dev-client` (skills `expo-dev-client`, `eas-app-stores`); Roger corre el
  primer `eas build --profile development`.

### M1 — Auth + shell de navegación por rol

**Web**: `auth.me` (protectedProcedure: rol + perfil mínimo), `auth.registerCustomer`
(público), `push.registerToken/unregisterToken` (upsert `PushToken`).

**Móvil** — skills `expo-router`, `expo-native-ui`:
- Route groups `(auth)`, `(customer)/(tabs)`, `(business)/(tabs)`, `(worker)/(tabs)` con gate
  de sesión en `src/app/_layout.tsx` y redirect por rol. Native tabs según diseño: Cliente
  Inicio/Órdenes/[botón central IA]/Mensajes/Perfil; Negocio Órdenes/Mensajes/Pagos/Equipo/
  Perfil; Trabajador Órdenes/Mensajes/Ruta/Perfil.
- Login/registro/recuperación (consume `auth.requestPasswordReset` existente), Google nativo,
  logout, manejo de 401 → limpiar token.

### M2 — Marketplace cliente + cámara + IA (C1–C3)

**Web**: router `marketplace.ts` (listCategories, listFeaturedProducts, search); router
`request.ts` (userProcedure: create, **diagnose** — `src/server/services/ai/diagnose.ts` con
Claude Sonnet vía AI Gateway → `{aiDiagnosis, aiConfidencePct, category, urgency, aiMin/MaxPriceCents}` +
producto/servicio sugeridos —, getById, listMine, cancel); router `address.ts` (CRUD);
servicio `notify-request` a negocios en radio (radio de `PlatformSettings`, push se activa
en M7).

**Móvil**: C1 home (ubicación `expo-location`, hero IA, grid categorías, destacados);
C2 `expo-camera` foto/video ≤30 s + galería, subida a Blob con progreso; C3 resultado IA con
CTAs "pedir cotizaciones" / "solo comprar producto".

### M3 — Cotizaciones + checkout escrow (C4–C5)

**Web**: router `quote.ts` lado cliente (listByRequest con precio/rating/distancia/horario/
garantía, accept); router `checkout.ts` (createIntent: Stripe Customer de `CustomerProfile`,
PaymentIntent escrow con snapshot de comisión + `customerServiceFeeCents`, devuelve
clientSecret/ephemeralKey para PaymentSheet; createProductIntent para compra directa);
extensión del webhook existente: confirmación → Order PAID + Payment IN_ESCROW +
`OrderEvent ESCROW_HELD` + Quote ACCEPTED (expira hermanas). Migración B + Stripe CLI (Roger).

**Móvil**: C4 comparador con sorts y badges; C5 detalle + `@stripe/stripe-react-native`
PaymentSheet (requiere rebuild del dev client — Roger).

### M4 — Tracking + chat con Pusher (C6, N3)

**Web**: router `messaging.ts` (getOrCreateConversation con guard multi-rol participante,
listMessages cursor, send TEXT/IMAGE/LOCATION, markRead) + trigger a **Pusher Channels**
(canal privado por conversación, auth endpoint `src/app/api/pusher/auth/route.ts` validando
Bearer/cookie); router `tracking.ts` (`getById` cliente con timeline `OrderEvent` + posición
worker; `worker.updateLocation` workerProcedure con throttle ≥15 s → evento Pusher del canal
de la orden). `payment.confirmDelivery` existente cierra el timeline.

**Móvil**: C6 mapa (`expo-maps`) con marker en vivo vía `pusher-js` + timeline + chat/llamar;
`src/features/chat/` universal para los 3 modos (burbujas, quick replies, adjuntos, ubicación
en vivo); pantalla de confirmación → `confirmDelivery`.

### M5 — Modo Negocio (N1, N2, N4–N7)

**Web**: router `radar.ts` (activeBusinessProcedure: listOpenRequests con geo-radio Haversine
vs Branch activa + filtro por categorías del negocio, evidencia + diagnóstico IA);
`quote.submit` (precio + horario + worker asignado con validación de tenancy, único por
[requestId, businessId]) y `quote.withdraw`; `order.acceptProduct`. Wallet y equipo **ya
existen** (`payment.*`, `team.*`) — solo consumo.

**Móvil**: N1 radar con tabs Nuevas/En curso/Historial; N2 detalle + asignación de worker +
enviar oferta; N4 wallet (balances, escrow, bonos, retiros); N5 panel de worker del negocio;
N6 equipo (invitar/reenviar); N7 perfil (garantía, sucursal, suscripción; administración
completa enlaza a la web con `expo-web-browser`).

### M6 — Modo Trabajador + grabación (T1–T4)

**Web**: router `worker-orders.ts` (workerProcedure): listAssigned, getById, `transition`
secuencial (EN_ROUTE → ARRIVED → RECORDING_STARTED con `OrderEvent` y Order IN_PROGRESS),
startRecording/stopRecording (crea/cierra `RecordingSegment`, interrupción marca
`interrupted`), `finish` (grabación subida + evidencia antes/después + notas + materiales →
`OrderEvent CONFIRMATION_REQUESTED` + notifica cliente; liberación por `confirmDelivery` o
auto-72 h ya existente), `setAvailability`. Migración C (Roger).

**Móvil**: T1 CTA secuencial con ruta y material; T2 grabación continua `expo-camera` +
`expo-keep-awake`, overlay REC/timestamp/geo, sin pausa, subida con reintentos, flujo de
justificación si se interrumpe; T3 cierre (evidencia, notas, materiales, enviar
confirmación); T4 toggle disponibilidad + stats + historial (sin acceso a pagos/equipo,
garantizado por el guard server-side).

### M7 — Push + pulido + EAS

**Web**: `src/server/services/push/expo-push.ts` (`expo-server-sdk`, limpieza de tokens
muertos) cableado a los adapters de notificación existentes en: request en radio, cotización
recibida, escrow retenido, cambios de `OrderEvent`, mensaje de chat, confirmación pedida,
escrow liberado, invitación. Namespace nuevo `src/messages/{es,en}/push.json`. Verificar que
el cron de auto-release emita push.

**Móvil** — skills `eas-app-stores`, `eas-workflows`: `expo-notifications` (registro al
login, handlers, deep links typedRoutes por rol); auditoría DESIGN-DIRECTIVE §7 en las 17
pantallas (4 estados, AA, reduced-motion, haptics); offline básico (React Query persist);
iconos/splash HOME360; `eas submit` a TestFlight/Play internal (Roger).

## Qué corre Roger (nunca el agente)

Migraciones A/B/C y seed; Stripe CLI (`stripe listen`); builds/submits EAS; alta de keys:
Pusher, Vercel Blob (`BLOB_READ_WRITE_TOKEN`), Vercel AI Gateway (`AI_GATEWAY_API_KEY`), Google Maps (Android para
`expo-maps`), proyecto EAS.

## Verificación por fase

- **Web**: `pnpm typecheck && pnpm check && pnpm build` en verde; probar procedures nuevos
  con datos seed (Prisma Studio para verificar filas).
- **Móvil**: `npx tsc --noEmit` + `expo start` con flujo manual sobre seeds de los 3 roles.
- **Hitos E2E**: M0 login por curl + tRPC con Bearer; M2 foto → diagnóstico → ServiceRequest
  en DB; M3 aceptar cotización con tarjeta test → Payment IN_ESCROW + OrderEvents; M4 chat
  en vivo entre dos sesiones + mapa con updates; M5 ciclo request → radar → cotizar → pagar;
  M6 ciclo completo hasta liberación de escrow por confirmación; M7 push end-to-end en
  device físico.

## Notas al margen (no bloquean)

- `design/` está en `.gitignore` del repo móvil: conviene versionar los HTML de diseño.
- README del repo móvil sigue siendo el del template.
