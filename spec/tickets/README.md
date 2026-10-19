# Pendientes de implementación — HOME360 web/API

Backlog activo, re-auditado contra el código el 2026-10-18 (`main` f8c179c). Las specs
`spec/00-foundations.md` … `spec/10-mobile-app.md` son contrato de producto, no backlog.
Un archivo presente aquí es trabajo real pendiente; al cerrarse se retira.

## Estado auditado (2026-10-18)

- F0–F7, XC, F8-01, F8-02 y P-WEB-02 están en código. `pnpm typecheck` y `pnpm check` en
  verde; cero TODO/FIXME en `src/`.
- Producción (Vercel `the-zen/home360`) despliega `main` automáticamente.
- Variables ausentes en Vercel: `PUSHER_*`, `NEXT_PUBLIC_PUSHER_*`, `SENDDM_API_KEY`,
  `SMS_FROM`; Stripe solo existe en `production` (no en `preview`).

## Plan de cierre

Flujo: web → rama + PR (el owner aprueba; merge a `main` despliega). Móvil →
`home360-app` PR a `main` + EAS (OTA al merge). Cada paso termina con `pnpm typecheck`, `pnpm check`,
`pnpm build` (web) o `tsc` + `expo lint` (móvil) y su prueba en preview/dev client.

### Fase 0 — Higiene y contrato

| # | Repo | Trabajo | Ticket |
|---|------|---------|--------|
| W1 | web | ✅ Crons en `vercel.json`, `.env.example` completo, sin `any` en sankey, backlog al día | P-WEB-01/04 |
| M1 | móvil | ✅ Contrato de tipos versionado (sin path al repo hermano), scripts `typecheck`/`doctor`, limpieza `app.json`, EAS workflows | P-MOB-00, M7-M2 |

### Fase 1 — Funcionalidad faltante

| # | Repo | Trabajo | Ticket |
|---|------|---------|--------|
| W2 | web | ✅ Receipts de Expo Push diferidos: tabla `PushReceipt` + `cron/push-receipts` | P-WEB-01 |
| W3 | web | ✅ Build de producción falla sin Stripe, Blob o AI Gateway (`src/env.js`) | P-WEB-03 |
| W4 | web | Perfil: avatar, formulario de contraseña único, `NumberTicker`, `SubmitStatusIcon` | F9-01 |
| W5 | web | ✅ F8-05 reescrito: solo prepago en USD (decisión owner 2026-10-18) | F8-05 |
| W6b | web | F10 fulfillment/discovery: API + dashboard (órdenes, solicitudes, sucursales, productos) + admin (órdenes, vencimientos). En código; falta `db:push`, `PICKUP_CODE_SECRET` en Vercel y prueba manual | F10 |
| M2 | móvil | T4: calificación y % a tiempo del trabajador (API + app) | M6-M3 |

### Fase 2 — Calidad, accesibilidad y diseño

| # | Repo | Trabajo |
|---|------|---------|
| W6 | web | Auditoría DESIGN-DIRECTIVE §8 por panel (a11y, teclado, contraste, 375/768/1024, 4 estados) |
| M3 | móvil | Auditoría §7/§8 por pantalla + `M7-findings.md`; findings M6 de grabación |
| M4 | móvil | ⏳ Iconos provisionales de marca (home360-app#7) |

### Fase 3 — Producción (owner)

- Decisiones P-WEB-03; `pnpm db:push` (incluye `PushReceipt`) + seed; variables faltantes en Vercel.
- Credenciales FCM/APNs en EAS; builds Android/iOS; envío a tiendas.
- E2E en dispositivo (P-WEB-04); backups y observabilidad.
- Posterior al lanzamiento: P-WEB-05.

## Tickets

- [`P-WEB-02`](P-WEB-02-mobile-api-gaps.md) — huecos API móvil (en código; falta E2E)
- [`P-WEB-03`](P-WEB-03-production-decisions.md) — decisiones de producción (owner)
- [`P-WEB-04`](P-WEB-04-operational-rollout.md) — rollout operativo (owner)
- [`P-WEB-05`](P-WEB-05-released-payment-refunds.md) — refunds sobre pagos liberados (posterior)
- [`F8-01`](F8-01-ai-assistant.md) — asistente IA (en código; falta `db:push` y prueba manual)
- [`F8-02`](F8-02-don-victor-widget.md) — Don Víctor (en código; falta verificación manual)
- [`F8-05`](F8-05-ai-models-pricing-credits.md) — créditos IA (implementado; falta `db:push` y verificar precio de Ling)
- [`F9-01`](F9-01-user-profile.md) — perfil por panel (avatar D2 y D4 pendientes)
- [`F10`](F10-fulfillment-discovery.md) — fulfillment DELIVERY/PICKUP, evidencia, stock, descubrimiento y chat pre-venta (API + web en código; falta `db:push`, `PICKUP_CODE_SECRET` y E2E; móvil en `M8`)
