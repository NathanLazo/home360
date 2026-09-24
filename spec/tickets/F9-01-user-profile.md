# [F9-01] Perfil de usuario por panel (business, corporate, admin)

## Metadatos

- **Fase:** F9 — Cuenta y consumo
- **Spec origen:** decisión del owner (2026-09-23): "falta una vista de perfil para todos los
  módulos donde se vea la configuración del usuario; el link va en el avatar del header;
  maneja billing y todo".
- **Depende de:** F8-01 (asistente), **F8-05** (catálogo de modelos, precios y créditos IA —
  la pestaña Facturación consume sus procedures; sin F8-05 la sección se entrega en estado
  "no disponible", nunca a medias).
- **Tamaño:** L
- **Estado:** planeado; pendiente de confirmación del owner sobre las decisiones abiertas D1–D5.

## Brief (shape)

### Trabajo y audiencia

Quien llega es el **dueño de la sesión** (owner de negocio, owner corporativo o admin) desde
el avatar del header, en medio de una tarea: quiere cambiar su nombre o contraseña, ver
cuánto lleva gastado en el asistente o comprar tokens. Modo **Operate**: escaneable,
predecible, sin espectáculo. Es una sola pantalla compartida por los tres paneles: la
identidad del panel la aporta el shell (sidebar, breadcrumb, chip de rol), no la vista.

### Resultado y prueba

- Una sola verdad para "todo lo mío": cuenta, seguridad, dispositivos, asistente y
  facturación IA. Lo que pertenece al tenant (datos fiscales del negocio, empresa
  corporativa, settings de plataforma) **no** vive aquí: se enlaza a su pantalla actual.
- Éxito visible: cada formulario guarda por separado con verbo en pasado ("Nombre
  actualizado"), el saldo de tokens se ve en mono con cifra verificable, cada cargo tiene
  fecha, modelo y tokens.
- Verdad de producto que nadie más puede copiar: el gasto de IA se muestra como un ledger
  auditable (mismo vocabulario de custodia que el escrow): tokens de entrada/salida, precio
  aplicado, origen (saldo prepagado o factura), nunca un "uso aproximado".

### Dirección seleccionada

- Autoridad visual: `DESIGN.md` intacto; sistema ink/zinc, personalidad Corporate.
- Tesis estructural: **cabecera de identidad + secciones ancladas con navegación lateral
  fija**. En desktop, el índice de secciones vive a la izquierda (sticky) y el contenido a
  la derecha, `max-w-[40rem]` como `/dashboard/settings`. En móvil el índice es una fila
  de chips horizontal con el siguiente chip asomando 16–24 px (`better-layout` §5).
- Momento focal: la card **Facturación IA** (saldo + acción "Comprar tokens"). Es la única
  acción de entrada de flujo de la pantalla → lleva el `Button beam`. El metal vivo se
  reserva para el botón de pago dentro del diálogo (`ConfirmDialog decisive`), que apaga el
  beam mientras está abierto (`beamActive={!open}`). Ningún otro botón lleva metal vivo.
- Sin glass en la página (son formularios). Presupuesto: 1 beam, 1 metal vivo, 0 glass.
- Consecuencia de implementación: módulo compartido `src/components/profile/` (mismo
  precedente que `src/components/agent/`), páginas delgadas en los tres paneles.

### Alcance y límites

- Fidelidad: pantalla production-ready, tres rutas, es/en al 100 %, cuatro estados.
- Se entrega: `/{panel}/profile` en dashboard, corporate y admin; entrada "Perfil" en el
  `UserMenu`; router `profile`; campos nuevos en `User`.
- Queda intacto: `/dashboard/settings`, `/corporate/settings`, `/admin/settings` (se
  enlazan, no se mueven). Las formas de contraseña existentes en business/corporate
  settings se **retiran** de ahí una vez que el perfil las absorbe (sub-tarea final, no
  bloqueante).
- Anti-goals: borrar cuenta (implicaciones legales/escrow, fuera), cambiar correo (requiere
  verificación, fuera; se muestra read-only con nota), vincular/desvincular Google (fuera;
  read-only), preferencias de notificación por usuario (D3), avatar con recorte (D2).

## Estructura de la pantalla

```
PageHeader "Perfil" — subtitle "Tu cuenta, seguridad y consumo del asistente"
┌──────────────────────────────────────────────────────────────────────────┐
│ ProfileIdentityHeader                                                    │
│  [UserAvatar 64]  Nombre (display-md)   [chip rol bg-metal]              │
│                   correo · Miembro desde 2026-03-12 (label mono)         │
└──────────────────────────────────────────────────────────────────────────┘
┌ ProfileSectionNav (lg: sticky col 12rem) ┐ ┌ contenido max-w-[40rem] ───┐
│ ○ Cuenta                                  │ │ #account   ProfileAccountCard│
│ ● Seguridad          (aria-current)       │ │ #security  ProfileSecurityCard│
│ ○ Dispositivos                            │ │ #devices   ProfileDevicesCard│
│ ○ Asistente                               │ │ #assistant ProfileAssistantCard│
│ ○ Facturación IA                          │ │ #billing   ProfileBillingCard│
│ ○ Espacio de trabajo                      │ │ #workspace ProfileWorkspaceCard│
└───────────────────────────────────────────┘ └──────────────────────────────┘
```

Orden por importancia (arriba = más frecuente): cuenta y seguridad primero, facturación
después de asistente porque depende de él; "Espacio de trabajo" cierra con enlaces
salientes. Agrupación por espacio, no por líneas: `gap-6` entre cards, `gap-5` entre campos,
`Separator` solo dentro de una card cuando dos formularios independientes comparten card
(patrón ya vigente en `settings-view.tsx`).

### Secciones y campos

| # | Sección | Contenido | Escritura |
|---|---------|-----------|-----------|
| 1 | **Cuenta** | Avatar (subir/quitar), nombre, correo (read-only + nota), idioma preferido (`User.locale`), rol (read-only) | `profile.updateIdentity` `{ name, locale }`, `profile.updateAvatar` `{ pathname \| null }` |
| 2 | **Seguridad** | Cambiar contraseña (o "Crear contraseña" si `hasPassword=false`, cuenta Google); cuentas vinculadas (Google conectado/no, read-only); "Cerrar sesión en todos los dispositivos" (rota `sessionsValidFrom`) | `profile.changePassword`, `profile.signOutEverywhere` |
| 3 | **Dispositivos** | Lista de `PushToken` del usuario: plataforma, nombre, último uso (mono); acción "Quitar" | `profile.listDevices`, `profile.removeDevice` |
| 4 | **Asistente** | Modelo por defecto (`User.agentDefaultModel`, sustituye el `localStorage` actual de `agent-chat`), con badge **Gratis** en `typesafe-ai/jev` y precio nuestro por millón de tokens (entrada/salida) en los de pago; uso del mes por modelo (tokens y costo) | `profile.updateAssistantPreferences` |
| 5 | **Facturación IA** | Saldo prepagado (MXN, `KpiValue` mono), pendiente por facturar, botón **Comprar tokens** (beam) → diálogo de paquetes → Stripe Checkout; ledger de consumo (fecha, modelo, tokens in/out, costo, origen saldo/factura); historial de compras; enlace a facturas del plan (`/dashboard/subscription` o `/corporate/membership`). Admin: la card muestra "Uso interno, sin cargo" + ledger, sin compra | F8-05: `aiBilling.getSummary`, `listUsage`, `listPurchases`, `createCreditCheckout` |
| 6 | **Espacio de trabajo** | Tarjeta de enlaces: negocio → Ajustes del negocio / Suscripción / Sucursales; corporativo → Empresa / Membresía / Ubicaciones; admin → Ajustes de plataforma | — |

Cada formulario es **independiente** (submit propio, botón deshabilitado hasta `isDirty`,
patrón `OwnerAccountForm`): nada de barra de guardado global, porque los cambios no son
atómicos entre sí y el usuario llega por una sola tarea.

## Estados y rangos

- **Loading:** `ProfileSkeleton` con la forma real: cabecera (círculo 64 + dos líneas),
  nav lateral (6 líneas), 6 cards con 2–4 filas cada una. Nunca skeleton genérico de 3
  rectángulos.
- **Error de carga:** `SectionError` con reintento (una sola query `profile.get`
  prefetched en `page.tsx`; facturación y dispositivos tienen queries propias con su
  propio `SectionError` dentro de la card, así un fallo de Stripe no tumba el perfil).
- **Vacíos:** sin dispositivos ("Aún no has iniciado sesión en la app móvil"); sin
  consumo ("El asistente aún no ha generado cargos"); saldo 0 con CTA "Comprar tokens";
  sin compras.
- **Éxito:** toast en pasado + `SubmitStatusIcon` en el botón 2 s; tras comprar,
  el saldo pasa de N a N+M con `NumberTicker` (reduced motion: cifra final directa).
- **Permisos:** bajo impersonación (`session.user.impersonator !== null`) toda escritura
  responde `IMPERSONATION_READ_ONLY`; la UI muestra el aviso de solo lectura y
  deshabilita submits, misma regla que F8-01.
- **Rangos:** nombre 2–80 chars; ledger paginado por cursor (25 por página, "Cargar más");
  dispositivos 0–10; saldo 0–999 999 MXN; tokens por fila hasta 10⁷ (formato `1.2 M`).
- **Sin gateway key (`AI_GATEWAY_API_KEY` ausente):** secciones Asistente y Facturación
  muestran el mismo aviso "no configurado" de F8-01, sin botón de compra.

## Interacción y motion (personalidad Corporate, feedback ≤300 ms)

Decisión previa por elemento (¿debe animar?, ¿frecuencia?, ¿propósito?):

| Elemento | ¿Anima? | Spec | Propósito |
|----------|---------|------|-----------|
| Navegación entre secciones (click en índice) | Scroll nativo `scroll-margin-top: 6rem`; **sin** `scroll-behavior: smooth` bajo reduced motion | — | Orientación |
| Indicador activo del índice | Sí | `SidebarActiveIndicator`-like: fondo `bg-canvas-soft-2` que se desliza 150 ms `smoothOut`; estado real por `aria-current`; observado con `IntersectionObserver` | Continuidad espacial |
| Botón de guardar habilitándose | Sí | Punto `bg-warning` "cambios sin guardar" junto al label: opacidad + scale 0.5→1, 200 ms (patrón `SettingsSaveBar`) | Estado, no solo color |
| Submit exitoso | Sí | `SubmitStatusIcon` → `SuccessCheck` con `MOTION_EASE.bounce` (único overshoot permitido: micro-éxito), 2 s de hold | Confirmación |
| Submit inválido | Sí | `useErrorShake` 300 ms, ±8 px, 2 oscilaciones; foco al primer campo inválido | Rechazo firme, sin rebote |
| Cambio de avatar (preview) | Sí | Crossfade 200 ms con `filter: blur(2px)` en el intermedio (Emil: el blur oculta el solape de dos estados); reduced motion: swap directo | Evitar el corte brusco |
| Quitar dispositivo | Sí | Fila sale con opacidad 150 ms; los hermanos se reacomodan con `SPRING_LAYOUT` (`motion` `layout`); reduced motion: sin layout animation | Causa-efecto |
| Diálogo "Comprar tokens" | Sí | 250 ms, `scale(0.97) + opacity 0 → 1`, `transform-origin: center` (es modal, no popover); cierre 150 ms; Escape sin animación de entrada repetida | Cambio de foco |
| Selección de paquete | Sí | Radio-card: borde `hairline` → `ring` 150 ms; press `active:scale-[0.97]` | Feedback de press |
| Saldo tras compra | Sí | `NumberTicker` ≤500 ms, tabular-nums; reduced motion → valor final | Énfasis en dinero |
| Cerrar sesión en todos lados | **No** | `ConfirmDialog` estándar; acción de teclado y rara: sin celebración | — |
| Cambio de idioma | **No** | `router.replace` con nuevo locale tras guardar; la hoja hace su crossfade de 150 ms ya existente | — |
| Hover en filas del ledger | Sí | `hover:bg-canvas-soft-2` 150 ms, gated con `@media (hover: hover)` | Escaneo |

Reglas duras: nunca `transition: all`; solo `transform`/`opacity` (color en hover); enter
más lento que exit; ningún elemento entra por scroll (herramienta, no landing); stagger
solo en el skeleton→contenido si se usa, ≤200 ms total y 40 ms entre cards; teclado nunca
dispara animación adicional.

## Layout responsivo

- `lg+`: grid `[12rem_minmax(0,40rem)]` con `gap-10`; nav `sticky top-24`.
- `md`: nav pasa a chips horizontales bajo la cabecera (`overflow-x-auto`, `scroll-snap`,
  último chip asomando); contenido a ancho completo `max-w-[40rem]`.
- `375`: cabecera apila avatar sobre texto; ledger pasa de tabla a lista de filas con dos
  líneas (fecha + modelo / tokens + costo); botones de formulario a ancho completo con
  inset de 16 px; áreas táctiles ≥44 px por el `::after` del `Button`.
- Propiedades lógicas (`ps-*`, `me-*`) en todo lo direccional; textos sin ancho fijo.

## Copy (namespace `profile`, es/en)

Sentence case, directo, sin exclamaciones. Claves obligatorias: `title`, `subtitle`,
`nav.*` (6), `identity.memberSince`, `account.*` (labels, `emailReadOnly`,
`localeLabel`, `avatar.upload|remove|hint`), `security.*` (`changePassword`,
`createPassword`, `linked.google.connected|notConnected`, `signOutEverywhere.title|
description|confirm|done`), `devices.*` (`empty`, `remove`, `lastSeen`, `platform.IOS|
ANDROID`), `assistant.*` (`defaultModel`, `free`, `pricePerMillion`, `contextWindow`,
`usageThisMonth`), `billing.*` (`balance`, `pendingInvoice`, `buy`, `packs.*`,
`ledger.columns.*`, `origin.PREPAID|INVOICE`, `internalNoCharge`, `invoicesLink`),
`workspace.*`, `feedback.*` (verbos en pasado), `readOnlyNotice`, `notConfigured`.
`common.userMenu.profile` = "Perfil" / "Profile".

## Arquitectura (contrato roger-arq)

### Prisma (`schema.prisma`; Roger ejecuta `pnpm db:push`)

```prisma
model User {
  // F9-01
  avatarPathname    String?   // Vercel Blob pathname (servicio media existente)
  agentDefaultModel String?   // id del catálogo AGENT_MODELS; null → DEFAULT_AGENT_MODEL_ID
}
```

`image` sigue siendo la URL de Google; `avatarPathname` tiene prioridad al renderizar.
Balance, ledger y compras de IA viven en F8-05 (`Business.aiCreditCents`,
`CorporateAccount.aiCreditCents`, `AiUsage`, `AiCreditPurchase`).

### Servicios (`src/server/services/profile/`)

- `profile-summary.ts` — `getProfileSummary(db, userId)`: `select` mínimo de `User` +
  `accounts.provider` + `hasPassword` + `pushTokens` + rol; nunca devuelve `passwordHash`.
- `update-identity.ts` — nombre + locale (Zod normaliza; `locale` ∈ `routing.locales`).
- `update-avatar.ts` — valida que el `pathname` sea propiedad del usuario (servicio
  `media/authorize-read.ts`) y borra el blob anterior.
- `change-password.ts` — reutiliza `verifyPasswordOrDummy` y la rotación de
  `sessionsValidFrom` de `business-settings`; acepta `currentPassword` opcional cuando
  `hasPassword=false` (crear contraseña para cuentas Google).
- `sign-out-everywhere.ts` — `sessionsValidFrom = now()`; el caller cierra su propia
  sesión web con `revokeWebSession`.
- `devices.ts` — `listDevices`, `removeDevice` (filtro `userId` en la query).
- `assistant-preferences.ts` — valida con `isAgentModelId`.

### Router `profile` (`src/server/api/routers/profile.ts`)

`protectedProcedure` + guard de rol de panel (mismo helper que `agent.ts`: CUSTOMER y
WORKER → `FORBIDDEN`). Procedures: `get`, `updateIdentity`, `updateAvatar`,
`changePassword`, `signOutEverywhere`, `listDevices`, `removeDevice`,
`updateAssistantPreferences`. Todas `TrpcResponse<T>`; escrituras bajo impersonación →
`IMPERSONATION_READ_ONLY` (409). Códigos nuevos en `errors.json`: `CURRENT_PASSWORD_INVALID`
(ya existe), `PASSWORD_ALREADY_SET`, `DEVICE_NOT_FOUND`, `AVATAR_NOT_OWNED`.

### UI

```
src/components/profile/
├─ profile-view.tsx              # orquesta query + estados; sin lógica de negocio
├─ profile-skeleton.tsx
├─ profile-identity-header.tsx
├─ profile-section-nav.tsx       # índice sticky / chips; IntersectionObserver
├─ profile-section-card.tsx      # Card con id + scroll-mt-24 (copia de admin SettingsSectionCard elevada a compartido)
├─ profile-account-card.tsx
│  ├─ profile-avatar-field.tsx
│  ├─ profile-identity-form.tsx
├─ profile-security-card.tsx
│  ├─ profile-password-form.tsx
│  ├─ profile-linked-accounts.tsx
│  ├─ profile-sign-out-everywhere.tsx
├─ profile-devices-card.tsx
│  ├─ profile-device-row.tsx
├─ profile-assistant-card.tsx
│  ├─ profile-model-picker.tsx   # radio-cards con badge Gratis / precio
│  ├─ profile-model-usage.tsx
├─ profile-billing-card.tsx
│  ├─ ai-balance-summary.tsx
│  ├─ buy-credits-dialog.tsx     # ConfirmDialog decisive, paquetes de F8-05
│  ├─ ai-usage-ledger.tsx / ai-usage-row.tsx
│  ├─ ai-purchase-history.tsx
├─ profile-workspace-card.tsx    # recibe links por área
├─ profile.schema.ts             # Zod compartido cliente/servidor
├─ profile.types.ts
└─ use-profile-mutations.ts      # toasts + invalidate + router.refresh (patrón use-settings-mutations)
```

Páginas: `src/app/[locale]/{dashboard,corporate,admin}/profile/page.tsx` + `loading.tsx`
(prefetch `profile.get`, `h1` vía `PageHeader`, props de área: `workspaceLinks`,
`billingMode: "tenant" | "internal"`). `UserMenu` recibe `profileHref` y añade
`DropdownMenuItem` "Perfil" (`UserRoundIcon`) antes del separador de cerrar sesión; los
tres headers lo pasan. `agent-chat.tsx` lee el modelo por defecto de `profile.get` y
mantiene `localStorage` solo como override de sesión.

## Checklist de entrega (DESIGN-DIRECTIVE §8)

- [ ] Cero strings hardcodeados; `profile.json` es/en completos y registrado en `i18n/request.ts`.
- [ ] Un `h1` (PageHeader); `h2` por card; sin saltos.
- [ ] Foco visible; orden de tab = orden visual; índice navegable con teclado.
- [ ] Contraste AA; `mute` nunca en copy esencial; origen del cargo con texto, no solo color.
- [ ] Reduced motion: sin ticker, sin layout spring, sin blur, mismo layout.
- [ ] Sin `transition: all`; solo `transform`/`opacity`.
- [ ] 375 / 768 / 1024 sin desbordes; táctil ≥44 px.
- [ ] Loading, empty, error y éxito por sección.
- [ ] Presupuesto: 1 `Button beam` (Comprar tokens), 1 metal vivo (pagar), 0 glass, sin mesh.
- [ ] `pnpm typecheck` y `pnpm check` en verde; `pnpm build` y `pnpm db:push` los corre Roger.

## Decisiones abiertas (bloquean solo su sección)

- **D1. Ruta:** `/{panel}/profile` (propuesto) vs. `/{panel}/settings/profile`. Propuesto:
  ruta propia; settings sigue siendo del tenant.
- **D2. Avatar:** subida directa a Vercel Blob sin recorte (propuesto, reutiliza
  `media/blob.ts`) vs. recorte en cliente. Requiere `BLOB_READ_WRITE_TOKEN` (pendiente).
- **D3. Notificaciones por usuario:** hoy solo existen flags de plataforma. Propuesto:
  fuera de F9-01; ticket F9-02 si se quiere `emailOrderUpdates`, `emailPaymentRelease`,
  `emailAssistantReceipts`.
- **D4. Contraseña en settings de negocio/corporativo:** retirarla de ahí al cerrar F9-01
  (propuesto) o mantener duplicada.
- **D5. Admin y billing:** propuesto "uso interno, sin cargo" con ledger visible para
  auditoría; alternativa: ocultar la card por completo.
