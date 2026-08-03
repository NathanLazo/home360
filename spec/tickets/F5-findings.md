# F5 — Hallazgos de la revisión de `spec/05-admin.md`

Revisión de la spec del panel admin (W9–W13) contra `spec/00-foundations.md`,
`spec/03-payments.md`, `spec/04-subscriptions.md`, los tickets `F5-01`…`F5-15` y los
tickets de F3 que F5 consume (fecha: 2026-07-30).

Aquí solo van los problemas que **no quedan cerrados dentro de un ticket**: o requieren
una decisión de Roger, o exigen editar la spec para que la resolución tomada en el ticket
sea la norma y no una interpretación. Los hallazgos ya registrados en
`spec/tickets/XC-findings.md` se citan como "ya cubierto en XC-NN" sin repetir el análisis.

Severidades (mismas que XC): **bloqueante** (contradicción que impide implementar o
corrompe dinero), **mayor** (hueco que un agente no puede resolver sin inventar),
**menor** (inconsistencia puntual, fix acotado).

---

## Bloqueantes

### F5-1 — La "cuenta Connect placeholder" de `approveBusiness` deja al negocio sin poder cobrar ni retirar

- **Sección**: `05-admin.md` §2 (`approveBusiness` → "transacción: `status ACTIVE` + crea
  `Subscription` (F4) + **cuenta Connect placeholder**"); `03-payments.md` §3 y §6
  (`connect-onboarding-banner.tsx` — "**Alert si falta `stripeAccountId`**").
- **Descripción**: dos problemas encadenados.
  1. **Stripe dentro de una transacción Prisma**: la spec mete la creación de la cuenta
     Connect (y la `Subscription` de Stripe Billing) en la misma transacción que el
     `UPDATE` local. Una llamada de red dentro de una transacción interactiva sostiene el
     lock hasta el timeout y, si Stripe responde después del rollback, deja objetos
     huérfanos en Stripe. `F5-05` lo resolvió sacando las llamadas Stripe fuera del commit
     (best-effort, idempotentes), pero la spec sigue diciendo lo contrario.
  2. **El placeholder rompe el onboarding**: si el admin crea la cuenta Express al
     aprobar, `Business.stripeAccountId` deja de ser `null` y el banner de W6 —cuya
     condición literal en `03-payments.md` §3/§6 es "falta `stripeAccountId`"— **nunca se
     muestra**. El negocio jamás completa el onboarding, `payoutsEnabled` se queda en
     `false` (F3-01) y entonces `releasePayment` falla con `NO_CONNECT_ACCOUNT` (F3-04) y
     `approveWithdrawal` también (F3-07): el dinero liberado no llega nunca al negocio.
- **Severidad**: bloqueante
- **Recomendación**: (a) en §2 reescribir la fila: "transacción Prisma = `status ACTIVE` +
  `Subscription` local; las llamadas a Stripe ocurren después del commit, idempotentes";
  (b) **eliminar la cuenta Connect placeholder** de `approveBusiness` (el alta la hace el
  propio negocio con `payment.startOnboarding`, F3) o, si se quiere conservar, cambiar en
  `03-payments.md` §3/§6 la condición del banner a
  `!business.payoutsEnabled || !business.chargesEnabled` (que además es la condición
  correcta aunque no haya placeholder: una cuenta creada y con onboarding a medias hoy
  tampoco muestra banner).

### F5-2 — La política de comisión en reembolso parcial no está en la spec y las dos resoluciones vigentes se contradicen

- **Sección**: `05-admin.md` §3 (tabla de resoluciones: `PARTIAL_REFUND` → "refund parcial
  + release del resto", sin decir qué pasa con la comisión); cruza con XC-03.
- **Descripción**: la spec define el movimiento pero no el reparto. Los tickets ya
  implementados adoptaron **comisión íntegra para la plataforma** (`F3-05` §Contexto 1 y
  `F5-07` §Contexto 2: neto liberado = `amount − partial − commission`), mientras que
  `XC-03` recomienda explícitamente lo contrario ("comisión sobre el monto no
  reembolsado", es decir proporcional). Con montos reales las dos políticas difieren y
  ambas están "escritas" en el repo: quien implemente `escrow.ts` o los saldos derivados
  elegirá una u otra y los KPIs de W3/W6/W12 dejarán de cuadrar. Detalle secundario del
  mismo hueco: la spec solo acota "monto > escrow → `VALIDATION_ERROR`", pero F3-05 acota
  el parcial a `amount − commission` con el código `REFUND_EXCEEDS_LIMIT` y F5-07 lo
  reexpresa como "neto ≤ 0 → `VALIDATION_ERROR`": mismo caso, dos códigos.
- **Severidad**: bloqueante (afecta dinero y ya hay dos verdades en circulación)
- **Recomendación**: escribir una frase normativa en `03-payments.md` §1 y citarla en
  `05-admin.md` §3. Recomendado mantener lo implementado (**comisión íntegra**, es la
  política más simple de auditar y la que ya tiene tests en F3-05/F5-07) y **corregir la
  recomendación de XC-03** en consecuencia, incluyendo la fórmula de disponible
  `Σ(amount − commission − refunded)` para `RELEASED` y `PARTIALLY_REFUNDED`. Unificar
  también el código de error del límite superior del parcial.

---

## Mayores

### F5-3 — Los rangos de validación de W13 están incompletos en la spec

- **Sección**: `05-admin.md` §5 (`update` → "rangos validados: umbral 50–99, margen 5–50,
  horas 1–336**…**").
- **Descripción**: los puntos suspensivos cubren 6 campos del singleton sin límite escrito
  (`customerServiceFeeCents`, `loyaltyBonusCents`, `loyaltyBonusEveryOrders`,
  `notifyNewRequestRadiusKm`, `notifyRatingReminderHours`, y el catálogo de
  `aiPricingModel`). El criterio de aceptación de la spec ("Settings validan rangos en
  servidor") no es verificable sin esa lista. `F5-13` los fijó para poder implementar:
  fee `0–20 000` centavos, bono `0–100 000` centavos, cada `1–1 000` órdenes, radio
  `1–100` km, recordatorio `1–168` h, y `aiPricingModel ∈ {v3.0, v3.1, v3.2}`.
- **Severidad**: mayor
- **Recomendación**: copiar esa tabla a `05-admin.md` §5 (o confirmar otros valores de
  negocio). Aclarar además que `aiPriceMarginPct` guarda la **magnitud** de la banda ±
  (por eso 5–50 positivo) y que `aiPricingModel` no tiene catálogo en BD: o se acepta la
  constante de código, o se agrega un modelo `AiPricingModel` al schema.

### F5-4 — El singleton `PlatformSettings` no lo crea nadie fuera del seed

- **Sección**: `05-admin.md` §5 (`get` → "`PlatformSettings` completo") y §1
  (`getAiConfigSummary`); `00-foundations.md` §3 y §9.
- **Descripción**: `PlatformSettings` es un singleton con `id @default(1)` que solo existe
  si se corrió `pnpm db:seed`. En un despliegue donde el seed no se ejecuta (producción es
  el caso normal), W9 y W13 responden `NOT_FOUND` y no hay ninguna ruta de recuperación
  desde la app: el admin no puede crear la configuración porque `update` también exige que
  la fila exista. `F5-02` y `F5-13` mantienen `NOT_FOUND` deliberadamente para no
  contradecirse entre sí.
- **Severidad**: mayor
- **Recomendación**: elegir una y escribirla en `spec/00` §3: (a) la migración inicial
  inserta la fila (`INSERT ... ON CONFLICT DO NOTHING` en el SQL de la migración), o (b)
  `getPlatformSettings` hace `upsert` con los defaults del schema. La (a) es preferible:
  mantiene el servicio de lectura sin efectos secundarios.

### F5-5 — La carrera entre resolver una disputa y el cron de auto-liberación no está escrita en ninguna spec

- **Sección**: `05-admin.md` §3 (tabla de resoluciones, que asume que el pago sigue
  `IN_ESCROW`); `03-payments.md` §5 ("auto-liberación": libera todo `escrowReleaseAt <= now`
  sin excluir órdenes disputadas).
- **Descripción**: tal como están escritas las specs, el cron puede liberar al negocio el
  pago de una orden `DISPUTED` minutos antes de que el admin resuelva con `FULL_REFUND`;
  el refund se intentaría sobre un pago ya `RELEASED` (que exigiría *transfer reversal*,
  fuera de alcance de F3). Los tickets ya lo blindaron por dos lados —`F3-04` excluye del
  cron los pagos cuya orden tenga disputa no `RESOLVED`, y `F5-07` exige
  `Payment.status === IN_ESCROW` en toda resolución monetaria (`CONFLICT` si no)—, pero
  ninguna spec lo dice, así que una reimplementación futura del cron puede reintroducir el
  agujero.
- **Severidad**: mayor
- **Recomendación**: en `03-payments.md` §5 añadir la condición al query del cron
  ("excluye pagos cuya orden tenga una `Dispute` con status ≠ `RESOLVED`") y en
  `05-admin.md` §3 añadir la precondición de `resolve` ("las 3 resoluciones monetarias
  exigen `Payment.status = IN_ESCROW`; si no, `CONFLICT`").

### F5-6 — `Withdrawal.stripeTransferId` guarda un id de **Payout**, y el modelo Transfer/Payout sigue sin decidirse

- **Sección**: `05-admin.md` §4 (`approveWithdrawal` → "llama `approveWithdrawal` de F3
  (**Transfer/Payout**)") y §7 ("aprobar retiro … → **Transfer** creado");
  `00-foundations.md` §3 (`Withdrawal.stripeTransferId`).
- **Descripción**: complementa **XC-08** (que señaló la ambigüedad terminológica), pero el
  problema sigue abierto y ahora con implementación divergente: `F3-02`/`F3-07` y `F5-11`
  crean un **Payout** desde la cuenta conectada (cuenta Express con `schedule.interval =
  "manual"`) y persisten `payout.id` en un campo llamado `stripeTransferId`, mientras que
  la resolución recomendada en XC-08 era la contraria (diferir el **Transfer** hasta la
  aprobación del retiro). Cualquiera de las dos funciona, pero hoy conviven la
  recomendación de XC y el código de F3/F5, y el nombre del campo miente respecto al
  objeto Stripe que almacena.
- **Severidad**: mayor
- **Recomendación**: ratificar el modelo **Payout** (ya implementado y probado en F3-07),
  actualizar XC-08 y `03-payments.md` §1 para que no hablen de Transfer en el retiro, y
  renombrar el campo a `stripePayoutId` en `spec/00` §3 (migración de renombrado, barata
  mientras no haya datos productivos). Corregir también `05-admin.md` §7 ("Transfer creado"
  → "Payout creado").

### F5-7 — "Bonos de lealtad pagados" sigue sin fuente de datos y hoy la UI mostraría una estimación como si fuera dinero real

- **Sección**: `05-admin.md` §4 (`getRevenueBreakdown` → `loyaltyBonusCents`;
  `revenue-breakdown-list.tsx` "en negativo").
- **Descripción**: ya cubierto en **XC-06** (no existe modelo de bonos otorgados). Sigue
  abierto y con una consecuencia nueva: para poder implementar, `F5-10` adoptó una
  **estimación derivada** (`floor(órdenes COMPLETED / loyaltyBonusEveryOrders) ×
  loyaltyBonusCents`) que `F5-12` pinta en negativo junto a comisiones y suscripciones
  reales. Un número inventado dentro de un desglose financiero es peor que un cero.
- **Severidad**: mayor
- **Recomendación**: decidir ya entre las dos opciones de XC-06. Recomendado para el
  alcance "solo web": `loyaltyBonusCents = 0` con nota "fuera de alcance web" en §4, y
  quitar la estimación de `F5-10`/`F5-12`. Si se prefiere el modelo `LoyaltyBonus`, debe
  entrar en el schema de `spec/00` §3 antes de implementar F5.

---

## Menores

### F5-8 — El efecto de cambiar `escrowAutoReleaseHours` sobre pagos ya en escrow no está definido

- **Sección**: `05-admin.md` §5 (`escrow-settings-section.tsx` — "horas de auto-liberación").
- **Descripción**: `Payment.escrowReleaseAt` se calcula y congela al cobrar (F3). La spec
  no dice si un cambio de 72 h a 24 h debe re-calcular las fechas de los pagos ya
  `IN_ESCROW` (adelantando pagos a negocios) o solo aplicar a pagos futuros. `F5-14` adoptó
  "solo pagos futuros" y lo hace visible con una nota en la UI.
- **Severidad**: menor
- **Recomendación**: escribir en §5 "aplica solo a pagos futuros; `escrowReleaseAt` se fija
  al cobrar y no se recalcula", igual que la nota de comisiones.

### F5-9 — `suspendBusiness` declara `reason?` opcional pero el dialog la exige

- **Sección**: `05-admin.md` §2 (fila `suspendBusiness` / `reactivateBusiness` →
  `{ businessId, reason? }`; módulo → `suspend-business-dialog.tsx` "AlertDialog con razón
  **obligatoria**").
- **Descripción**: la firma compartida por dos mutations distintas produce un input
  ambiguo: si `reason` es opcional, el servidor aceptaría suspensiones sin motivo que la
  UI nunca permite, y el campo quedaría vacío en el sheet de detalle. `F5-06` separó las
  firmas (obligatoria en suspender, inexistente en reactivar).
- **Severidad**: menor
- **Recomendación**: partir la fila de la tabla en dos:
  `suspendBusiness { businessId, reason: string }` y `reactivateBusiness { businessId }`
  (esta última limpia `statusReason`).

### F5-10 — "`CONFLICT` si tiene disputa abierta (suspender no; reactivar sí bloqueado)" es ambiguo

- **Sección**: `05-admin.md` §2 (misma fila que F5-9).
- **Descripción**: la frase admite dos lecturas opuestas sobre qué operación se bloquea.
  `F5-06` eligió: suspender **sí** se permite con disputa abierta (se suspende justamente
  por eso), reactivar **no**.
- **Severidad**: menor
- **Recomendación**: reescribir como dos reglas explícitas: "`suspendBusiness` no valida
  disputas; `reactivateBusiness` → `CONFLICT` si el negocio tiene alguna `Dispute` con
  status ≠ `RESOLVED`".

### F5-11 — Estado final de `Order` para `PARTIAL_REFUND` y `RELEASE_PAYMENT`

- **Sección**: `05-admin.md` §3 (tabla de resoluciones).
- **Descripción**: ya cubierto en **XC-19**. `F5-07` implementó la recomendación
  (`COMPLETED` en ambas, `DISPUTED` intacto en `MORE_EVIDENCE`); falta reflejarlo en la
  tabla para que los KPIs de F2 no diverjan.
- **Severidad**: menor
- **Recomendación**: completar la columna "Estado" de la tabla §3 tal cual XC-19.

### F5-12 — Documentos de garantía en el detalle de negocio

- **Sección**: `05-admin.md` §2 (`getBusinessDetail` → "garantía, **docs**, órdenes,
  disputas"; `business-detail-sheet.tsx` "perfil + **documentos** + historial").
- **Descripción**: ya cubierto en **XC-23** y en `F0-findings.md` §B1: no existe modelo ni
  campo de documentos. `F5-03`/`F5-04` dejan un empty-state permanente, es decir una
  sección de UI que nunca tendrá contenido.
- **Severidad**: menor
- **Recomendación**: resolver XC-23 antes de implementar F5-04. Si no habrá modelo, quitar
  "docs/documentos" de §2 y dejar solo `guaranteeType` + `guaranteeNotes` (así el sheet no
  arrastra una sección muerta).

### F5-13 — W9 muestra `PlatformSettings.updatedAt` como "última actualización" de la configuración de IA

- **Sección**: `05-admin.md` §1 (`getAiConfigSummary` → "umbral, modelo, **última
  actualización**").
- **Descripción**: `updatedAt` es del singleton completo: cambiar el radio de
  notificaciones o el bono de lealtad hará que W9 diga que la configuración de IA se
  actualizó. No existen timestamps por sección.
- **Severidad**: menor
- **Recomendación**: reformular el copy de la card a "Configuración actualizada el …" (sin
  atribuirlo a IA), o agregar `aiUpdatedAt` al modelo si el dato debe ser específico.

### F5-14 — Nadie audita quién cambia la configuración de plataforma

- **Sección**: `05-admin.md` §5 (router `admin.settings`).
- **Descripción**: `update` y `updatePlanCommissions` modifican variables de dinero
  (comisiones, tarifa al cliente, bono) y de riesgo (umbral IA, horas de escrow) sin
  registrar autor ni valor anterior, y sin control de concurrencia: dos admins con la
  pantalla abierta se pisan en silencio (último submit gana).
- **Severidad**: menor
- **Recomendación**: mínimo, agregar `PlatformSettings.updatedById String?` y mostrarlo en
  W13/W9. Si se quiere trazabilidad real, un modelo `PlatformSettingsChange { id, adminId,
  field, oldValue, newValue, createdAt }` escrito en la misma transacción del `update`.

### F5-15 — Ninguna fase consume los valores que W13 configura

- **Sección**: `05-admin.md` §5 (secciones IA, tarifas y notificaciones).
- **Descripción**: dentro del alcance web (F0–F6) solo dos campos tienen lector real:
  `escrowAutoReleaseHours` (F3, al cobrar) y los `Plan.commissionPct` (F3, al congelar la
  comisión). `aiConfidenceThresholdPct`, `aiPriceMarginPct`, `aiPricingModel`,
  `aiHumanReviewBelowThreshold`, `customerServiceFeeCents`, `loyaltyBonus*` y los tres
  campos `notify*` no se leen en ninguna spec: W13 es un panel de escritura sin
  consumidor, y no existe ningún emisor de notificaciones en el producto web.
- **Severidad**: menor (informativo, pero condiciona expectativas de la verificación)
- **Recomendación**: anotar en §5, por campo, quién lo consume ("app móvil futura" en la
  mayoría), para que nadie implemente "el envío de notificaciones" por iniciativa propia
  ni espere que cambiar el margen de IA tenga efecto visible en la web.

### F5-16 — `exportCsv` devuelve el archivo completo por tRPC sin límite escrito

- **Sección**: `05-admin.md` §2 (`exportCsv { tab }` → `{ csv: string }`, "descarga
  client-side").
- **Descripción**: el CSV entero viaja serializado en la respuesta tRPC (superjson) y se
  materializa en memoria del servidor y del navegador. La spec no fija tope de filas;
  `F5-03` capó a 5 000 por su cuenta.
- **Severidad**: menor
- **Recomendación**: fijar el tope en §2 (p. ej. 5 000 filas con aviso en la UI) o
  cambiar la exportación a un route handler con streaming
  (`/api/admin/export/[tab]`) cuando el volumen lo justifique.

### F5-17 — `admin.disputes.list` sin paginación mientras W10 sí la tiene

- **Sección**: `05-admin.md` §3 (`list { status? }` → `{ items, openCount,
  resolvedThisMonth }`) vs. §2 (`list { …, cursor? }`).
- **Descripción**: el listado de disputas trae todo el histórico (`status` sin filtro →
  "todas"), sin cursor ni límite. Con el tiempo la pantalla carga una lista ilimitada.
  `F5-08` lo aceptó tal cual por ser consistente con la spec.
- **Severidad**: menor
- **Recomendación**: agregar `cursor?` y `take` a `list` en §3 (mismo patrón que §2), o
  declarar explícitamente que el filtro "Resueltas" se acota al mes en curso.

### F5-18 — "Usuarios totales" de W9 no define qué roles cuenta

- **Sección**: `05-admin.md` §1 (`getKpis` → `totalUsers`, `newUsersMonth`).
- **Descripción**: `User` incluye `ADMIN`, `BUSINESS`, `CUSTOMER` y `WORKER`. Contar todos
  mezcla al equipo interno con los usuarios de la plataforma; el diseño sugiere "usuarios"
  como clientes + dueños de negocio. `F5-02` implementa el conteo total.
- **Severidad**: menor
- **Recomendación**: precisar en §1: `totalUsers = count(User where role != ADMIN)` (o el
  criterio que Roger prefiera) y aplicarlo también a `newUsersMonth`.

### F5-19 — Las pruebas de §6 asumen una base de datos real

- **Sección**: `05-admin.md` §6 (`finance-kpis.test.ts`: "breakdown cuadra con **seed**";
  `approve-business.test.ts`: "transacción crea suscripción").
- **Descripción**: el proyecto solo instala `vitest` (`spec/00` §2), sin base de datos de
  prueba ni contenedor; el resto de tickets testea con fakes inyectados. "Cuadrar con el
  seed" no es ejecutable sin infraestructura de integración. `F5-10` lo resolvió con
  fixtures equivalentes al seed.
- **Severidad**: menor
- **Recomendación**: reescribir §6 como pruebas unitarias con fixtures (lo implementado), o
  añadir a `spec/00` una base de datos de test y el comando correspondiente si se quiere
  cobertura de integración real.

### F5-20 — Verificaciones de §7 sobre datos del seed sin objetos Stripe

- **Sección**: `05-admin.md` §7.
- **Descripción**: ya cubierto en **XC-09** (los pagos y retiros sembrados no tienen
  `stripePaymentIntentId` ni cuenta Connect real, así que refunds y payouts fallarían con
  `STRIPE_ERROR`). Se repite aquí porque §7 es el criterio con el que Roger va a validar
  F5 completa.
- **Severidad**: menor
- **Recomendación**: aplicar (a)+(b) de XC-09 antes de dar F5 por verificada.

---

## Ya cubiertos en `XC-findings.md` (sin análisis nuevo)

| Tema de `05-admin.md` | Hallazgo XC | Estado en tickets F5 |
|---|---|---|
| `approveBusiness` necesita artefactos de F4 (dependencia declarada solo a F3) | XC-02 | `F5-05` asume F4 completada; sigue pendiente corregir el mapa de fases del README |
| `rejectBusiness` sin estado `REJECTED` ni campo de razón | XC-05 | `F5-05` agrega `REJECTED` + `Business.statusReason` (migración de Roger) |
| Bonos de lealtad sin modelo | XC-06 | ver F5-7 arriba |
| Transfer vs. Payout en retiros | XC-08 | ver F5-6 arriba |
| `MORE_EVIDENCE` y la transición `OPEN → IN_REVIEW` | XC-11 | `F5-07` implementa la resolución de XC-11 |
| Documentos de negocio en W10 | XC-23 | ver F5-12 arriba |
| Estado de `Order` en resoluciones parciales | XC-19 | ver F5-11 arriba |
| Definiciones de GMV / `subscriptionCents` / naming `escrowOrders` | XC-21 | `F5-02` y `F5-10` fijan definiciones operativas; falta escribirlas en la spec |
| `slider`, `radio-group`, `react-hook-form`, `@hookform/resolvers` sin instalar | XC-14, XC-15 | `F5-14`/`F5-15` dependen de `XC-13` |

---

## Correcciones recomendadas a `spec/05-admin.md`

1. **§1 (W9)**: definir `totalUsers`/`newUsersMonth` por rol (F5-18); reformular el copy de
   "última actualización" de la card de IA (F5-13); incorporar las definiciones de GMV de
   XC-21.
2. **§2 (W10)**: reescribir `approveBusiness` sin Stripe dentro de la transacción y sin la
   cuenta Connect placeholder (F5-1); partir la fila `suspend/reactivate` en dos firmas y
   desambiguar el `CONFLICT` por disputa abierta (F5-9, F5-10); quitar "docs" del detalle
   o crear el modelo (F5-12); fijar el tope de `exportCsv` (F5-16).
3. **§3 (W11)**: completar el estado final de `Order` en la tabla (F5-11); escribir la
   política de comisión del reembolso parcial y unificar el código de error del límite
   (F5-2); añadir la precondición `Payment.status = IN_ESCROW` para las resoluciones
   monetarias (F5-5); considerar cursor en `list` (F5-17).
4. **§4 (W12)**: resolver "bonos de lealtad" (F5-7); reemplazar "Transfer" por "Payout" y
   renombrar el campo del schema (F5-6).
5. **§5 (W13)**: publicar la tabla completa de rangos y el catálogo de `aiPricingModel`
   (F5-3); documentar el bootstrap del singleton (F5-4); anotar que
   `escrowAutoReleaseHours` y las comisiones aplican solo a pagos futuros (F5-8); agregar
   autoría/auditoría de los cambios (F5-14); anotar el consumidor de cada variable (F5-15).
6. **§6 (Pruebas)**: expresarlas como pruebas unitarias con fixtures, o dotar al proyecto
   de una base de datos de test (F5-19).
7. **§7 (Verificación)**: rehacer los pasos que requieren objetos Stripe reales (F5-20 /
   XC-09) y corregir "Transfer creado" → "Payout creado".
