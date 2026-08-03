# F0 — Hallazgos de la revisión de spec

Revisión de `spec/00-foundations.md` contra el repo real y las specs 01–06
(fecha: 2026-07-30). Dos secciones: decisiones ya **resueltas dentro de los tickets**
(requieren que Roger valide y, si está de acuerdo, actualice la spec) y problemas
**abiertos** que necesitan decisión.

---

## A. Resueltos en tickets — validar y reflejar en las specs

### A1. `Payment.orderId` obligatorio contradice los links de cobro de F3 — **Alta**

`spec/00` §3 define `Payment.orderId String @unique` (obligatorio), pero `spec/03` §5
exige crear un `Payment` cuando se paga un `PaymentLink`, que no tiene orden.
**Resolución (F0-03)**: `orderId` opcional + `paymentLinkId String? @unique` con relación
1–1 a `PaymentLink`. **Recomendación**: actualizar el bloque Prisma de `spec/00` §3 y
mencionar la relación en `spec/03` §5.

### A2. Rechazo de negocios sin estado ni campo de razón — **Alta**

`spec/05` §2 define `rejectBusiness { businessId, reason }` y `suspendBusiness { reason? }`,
pero `BusinessStatus` no tiene `REJECTED` ni `Business` campo para la razón.
**Resolución (F0-03)**: enum gana `REJECTED`; `Business.statusReason String?`.
**Recomendación**: actualizar `spec/00` §3; confirmar en `spec/05` la semántica
(¿un negocio REJECTED puede re-aplicar?).

### A3. `ctx.business.plan` es nullable (negocio PENDING sin suscripción) — **Alta**

`spec/00` §5 hace que `businessProcedure` cargue `subscription.plan`, pero `spec/01` §2
establece que un negocio PENDING no tiene suscripción (se crea al aprobar, F5). `spec/02`
usa `ctx.business.plan.maxProducts` como si siempre existiera.
**Resolución (F0-05)**: `ctx.business = { id, status, plan: PlanLimits | null }`; los
servicios de límites tratan `plan === null` como estado no operativo.
**Recomendación**: nota en `spec/02` §3 (`assertPlanLimit` debe manejar `null`).

### A4. Firma de `fail` incompatible con códigos de error por módulo — **Media**

`spec/00` §4: `fail(error: ErrorCode, …)` no compila con códigos de módulo
(`EMAIL_TAKEN`, `SKU_TAKEN`) que la misma sección promete vía genérico `TError`.
**Resolución (F0-04)**: `fail<T, E extends string = ErrorCode>(error: E | ErrorCode, …)`.
**Recomendación**: actualizar el snippet de la spec.

### A5. Falta middleware y plugin de next-intl en F0 — **Media**

Sin `src/middleware.ts` (`createMiddleware(routing)`) y `createNextIntlPlugin` en
`next.config.js`, `/en` no responde — el criterio de aceptación de F0 fallaría. `spec/01`
§3 asume que el middleware ya existe para "componerlo" con auth.
**Resolución (F0-07)**: F0 crea la versión solo-i18n; F1 la extiende.
**Recomendación**: añadir ambos puntos a `spec/00` §6.

### A6. `env.js` aún exige variables de Discord y no existe `.env.example` — **Media**

`AUTH_DISCORD_ID/SECRET` son obligatorias hoy (la app no arranca sin ellas) y la spec §1
no las menciona; §8 dice "`.env.example` actualizado" pero el archivo no existe.
**Resolución (F0-01, F0-10)**: se eliminan las de Discord; `.env.example` se crea desde
cero; las variables nuevas son opcionales en desarrollo (patrón `AUTH_SECRET`).

### A7. Desviaciones menores de dependencias — **Baja**

- `@types/bcryptjs` innecesario con `bcryptjs@^3` (tipos bundled) — F0-02 no lo instala.
- `recharts` se fija `^2.15` por compatibilidad React 19.
- `sonner` de shadcn importa `next-themes`; se edita el componente para no depender de él
  (no hay theme switching en el producto).
- Índices agregados por regla de la propia spec: `Order.serviceId`, `Order.productId`,
  `Review.customerId`, `Payment @@index([status, escrowReleaseAt])`;
  `PlatformSettings.createdAt`.

### A8. Valores de seed no especificados — **Baja**

Contraseñas y emails de los usuarios demo no están en la spec; F0-11 fija
`admin@home360.mx / Home360!admin`, `garcia@plomeriagarcia.mx / Home360!demo`, etc.
Cambiarlos ahí si se prefieren otros.

### A9. Ubicación de la landing — **Baja**

`spec/00` §1 dice "`page.tsx` bajo `[locale]`"; `spec/06` la ubica en
`[locale]/(public)/page.tsx`. F0-07 crea el grupo `(public)` desde el inicio.

---

## B. Abiertos — requieren decisión de Roger

### B1. Documentos de garantía de los negocios — **Media** (bloquea parte de F5, no F0)

`spec/05` §2 (`getBusinessDetail`) menciona "perfil completo: garantía, **docs**…" y el
dialog de aprobación "revisar garantía", pero ningún modelo almacena documentos/evidencias
de la garantía (solo `guaranteeNotes String?`).
**Recomendación**: decidir si habrá un modelo `BusinessDocument` (url + tipo + estado de
revisión) y en qué fase se sube el archivo (registro F1 vs. carga posterior). Si se
decide pronto, conviene incluirlo en la migración inicial de F0-03 para no re-migrar.

### B2. `Business.stripeCustomerId` diferido a F4 — **Baja**

`spec/04` §2 agrega la columna en su propia migración. Funciona, pero si se quiere
minimizar migraciones podría entrar ya en F0-03 (columna opcional inofensiva).
**Recomendación**: decidir; si sí, una línea en F0-03 y actualizar `spec/04`.

### B3. Badge "Pagado" de W6 sin estado equivalente en `PaymentStatus` — **Baja** (F3)

`spec/03` §6 lista los badges "En escrow / Pagado / Liberado / Reembolsado", pero el enum
es `PENDING | IN_ESCROW | RELEASED | REFUNDED | PARTIALLY_REFUNDED` — no hay `PAID`.
Probable intención: "Pagado" = pago de link cobrado (sin escrow) o `PENDING` confirmado.
**Recomendación**: definir el mapeo exacto estado→badge en `spec/03` antes de F3.

### B4. `folio` global vs. por negocio — **Baja**

`Order.folio` autoincrement es una secuencia **global** de la plataforma (así lo sugiere
el diseño "#1042" y lo implementa F0-03). Si Roger esperaba folios por negocio, cambia el
modelado (contador por tenant, transaccional).
**Recomendación**: confirmar; el default actual es global.

### B5. Rol WORKER sin procedure ni superficie web — **Informativo**

`UserRole.WORKER` existe y W10 lista trabajadores, pero ninguna fase define login/flujo
web para workers (solo app móvil futura). Sin acción para F0; documentado para que nadie
"complete" el hueco por iniciativa propia.

---

## Correcciones recomendadas a `spec/00-foundations.md` (resumen)

1. §3: aplicar el bloque Prisma con A1, A2, A7 (índices, `createdAt` en settings).
2. §4: firma genérica de `fail` (A4).
3. §5: documentar `plan: PlanLimits | null` en `ctx.business` (A3) y el puente de tipado
   de `session.user.role` en F0 con estrategia database (F0-05).
4. §6: agregar `src/middleware.ts` y `createNextIntlPlugin` (A5); ubicar la landing en
   `(public)` (A9).
5. §1/§8: mencionar la eliminación de las env vars de Discord y la **creación** de
   `.env.example` (A6).
6. §2: `bcryptjs@^3` sin `@types/bcryptjs`; `recharts@^2.15`; agregar `tsx` y la config
   de vitest (A7, F0-02).
7. §9: fijar credenciales/emails demo elegidos (A8) o los que Roger prefiera.
