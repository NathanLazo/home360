# XC — Auditoría de consistencia transversal (specs F0–F6)

> Auditoría entre specs (`spec/README.md`, `spec/00`–`spec/06`). Cada hallazgo indica
> dimensión, specs afectadas, evidencia (sección citada), severidad y resolución
> recomendada. Ningún spec fue modificado; los hallazgos autocontenidos tienen ticket
> propio (`XC-NN-*.md`).

Severidades: **bloqueante** (contradicción que impide implementar o corrompe dinero),
**mayor** (hueco que un agente no puede resolver sin inventar), **menor** (inconsistencia
puntual, fix acotado).

---

## Bloqueantes

### XC-01 — `Payment.orderId` es obligatorio pero los pagos de links de cobro no tienen orden

- **Dimensión**: 1 (schema vs. consumo) + 2 (contratos entre fases)
- **Specs**: `00-foundations.md` §3 (modelo `Payment`), `03-payments.md` §2, §5, §6
- **Descripción**: en F0 `Payment` define `orderId String @unique` (no nullable) con
  relación obligatoria a `Order`. F3 §5 exige que el webhook
  `checkout.session.completed` "marca `PaymentLink.paidAt` + **Payment del link**", y W6
  (§6) muestra una tabla de transacciones que mezcla pagos de órdenes y de links. Un pago
  originado en un `PaymentLink` **no tiene orden**: es imposible crear ese `Payment` con
  el schema de F0. Además `PaymentLink` no tiene relación alguna con `Payment`, así que
  tampoco se puede unir el pago al link para la tabla ni para los saldos (§1: el escrow y
  el disponible se derivan de `Payment`; si el pago del link no se persiste como
  `Payment`, el dinero cobrado por link nunca entra a los saldos).
- **Severidad**: bloqueante
- **Resolución recomendada**: en `spec/00` hacer `Payment.orderId String? @unique` y
  agregar `paymentLinkId String? @unique` + relación `PaymentLink.payment Payment?`, con
  la regla "exactamente uno de `orderId`/`paymentLinkId` presente" (validada en servicio).
  Ajustar F3 §5 para citar el nuevo campo. Ver ticket `XC-01-payment-link-payment-relation.md`.

### XC-02 — `admin.users.approveBusiness` (F5) necesita artefactos de F4, pero F5 declara depender solo de F3

- **Dimensión**: 7 (dependencias y orden de fases) + 2 (contratos) + 1 (schema)
- **Specs**: `README.md` (mapa de fases: "05-admin | F3"), `04-subscriptions.md` §1–§2,
  `05-admin.md` §2
- **Descripción**: F5 §2 define `approveBusiness { businessId, planCode }` como
  "transacción: `status ACTIVE` + crea `Subscription` (F4) + cuenta Connect placeholder".
  Crear la suscripción Stripe requiere: (a) la columna `Business.stripeCustomerId`, que
  **no existe en el schema de F0** y F4 §2 la agrega "en la migración de esta fase"; y
  (b) `Plan.stripePriceId` poblado por `scripts/sync-stripe-plans.ts`, que F4 §1 crea y
  Roger ejecuta en F4. Si F5 se implementa después de F3 pero antes de F4 (orden que el
  mapa del README permite), `approveBusiness` no puede cumplirse. Inconsistencia
  secundaria: F4 §2 dice que al aprobar se usa el plan "`standard` **por defecto**",
  mientras F5 exige `planCode` obligatorio elegido en `approve-business-dialog.tsx`.
- **Severidad**: bloqueante
- **Resolución recomendada**: en `README.md` cambiar la dependencia de `05-admin.md` a
  "F3 + F4" (y en F5 línea 1 "Requiere F3" → "Requiere F3 y F4"). Alternativa si se
  quiere mantener F5 antes de F4: especificar en F5 que `approveBusiness` crea solo la
  `Subscription` **local** y que F4 la sincroniza con Stripe (elegir una de las dos y
  escribirla). Unificar en F4 §2 que el plan lo elige el admin (`planCode`), eliminando
  "standard por defecto".

### XC-03 — Fórmula de "Disponible" incompleta: ignora la comisión y los pagos `PARTIALLY_REFUNDED`

- **Dimensión**: 5 (dinero) + 4 (estados)
- **Specs**: `03-payments.md` §1 y §7, `05-admin.md` §3, `02-business-dashboard.md` §1
- **Descripción**: F3 §1 define "**Disponible** = Σ `RELEASED` − Σ retiros
  `APPROVED|REQUESTED`". Dos problemas cruzados con otras specs:
  1. F3 §1 también dice que al liberar se transfiere `amountCents − commissionCents`. Si
     "Σ `RELEASED`" suma `amountCents` bruto, el disponible queda inflado por la comisión
     de cada pago; el negocio podría solicitar retiros por dinero que la plataforma
     retuvo. La spec nunca dice si la suma es bruta o neta.
  2. F5 §3 (tabla de `resolve`): `PARTIAL_REFUND` → "refund parcial + release del resto",
     estado final del Payment `PARTIALLY_REFUNDED` (no `RELEASED`). Ese "resto liberado"
     jamás entra a "Σ `RELEASED`", así que el dinero realmente transferido tras una
     disputa parcial **nunca aparece en el disponible** ni puede retirarse.
  Efecto colateral en F2 §1: "revenue = pagos `IN_ESCROW|RELEASED`" también excluye
  `PARTIALLY_REFUNDED` y no descuenta `refundedCents`, por lo que los KPIs de W3 no
  cuadran con W6/W12 tras una disputa.
  (Verificado OK: los retiros `REJECTED` quedan correctamente fuera de la resta en F3 §1
  y el test de §7 lo confirma — sin hallazgo ahí.)
- **Severidad**: bloqueante
- **Resolución recomendada**: reescribir F3 §1 con fórmulas exactas en neto:
  `Disponible = Σ_{RELEASED, PARTIALLY_REFUNDED} (amountCents − commissionCents − refundedCents) − Σ retiros REQUESTED|APPROVED`
  (para `PARTIALLY_REFUNDED` la comisión aplicada al remanente debe definirse: recomendar
  comisión sobre el monto no reembolsado). Alinear F2 §1 (revenue neto de
  `refundedCents`, incluir `PARTIALLY_REFUNDED`) y F5 §4 KPIs. Ver ticket
  `XC-03-derived-balance-formulas.md`.

---

## Mayores

### XC-04 — F6 usa `assertPlanLimit` (creado en F2) pero declara depender solo de F1

- **Dimensión**: 7 (dependencias) + 2 (contratos)
- **Specs**: `README.md` (mapa: "06-landing-polish | F1"), `06-landing-polish.md` §2,
  `02-business-dashboard.md` §3
- **Descripción**: F6 §2 (`/dashboard/team`) exige `create` de `Worker` "con
  `assertPlanLimit("workers")`". Ese servicio
  (`src/server/services/subscription/plan-limits.ts`) se crea en F2 §3 y se completa en
  F4 §3. Con la cadena declarada (F6 ← F1), el servicio no existe. Además F6 §2 usa el
  patrón de módulo estándar (DataTable, Sheet, mutations) definido en F2 §2.
- **Severidad**: mayor
- **Resolución recomendada**: en `README.md` y en la línea 4 de F6 cambiar la dependencia
  a "F2 (puede correr en paralelo a F3–F5)". Alternativa: mover la creación de
  `plan-limits.ts` a F0 §8 (scaffolding), pero es más simple corregir la dependencia.

### XC-05 — `rejectBusiness` no tiene estado destino: `BusinessStatus` carece de `REJECTED` y no hay dónde persistir `reason`

- **Dimensión**: 4 (máquinas de estados) + 1 (schema)
- **Specs**: `00-foundations.md` §3 (`enum BusinessStatus { PENDING ACTIVE SUSPENDED }`,
  modelo `Business`), `05-admin.md` §2
- **Descripción**: F5 §2 define `rejectBusiness { businessId, reason }` y
  `suspendBusiness { businessId, reason? }`. El enum de F0 no tiene `REJECTED` (¿un
  negocio rechazado queda `PENDING` para siempre? ¿desaparece?), y `Business` no tiene
  ningún campo para persistir la razón de rechazo/suspensión (solo `guaranteeNotes`, que
  es otra cosa). El input `reason` se pierde.
- **Severidad**: mayor
- **Resolución recomendada**: en `spec/00` agregar `REJECTED` a `BusinessStatus` y un
  campo `Business.statusReason String?` (escrito por reject/suspend, limpiado al
  reactivar/aprobar). En F5 §2 documentar la transición `PENDING → REJECTED` y que
  `business-detail-sheet.tsx` muestra la razón. Ver ticket
  `XC-05-business-rejected-status.md`.

### XC-06 — "Bonos de lealtad pagados" (W12) no tiene fuente de datos en el schema

- **Dimensión**: 1 (schema vs. consumo) + 5 (dinero)
- **Specs**: `00-foundations.md` §3, `05-admin.md` §4
- **Descripción**: F5 §4 `getRevenueBreakdown` retorna `loyaltyBonusCents` y el módulo
  incluye `revenue-breakdown-list.tsx` con "'Bonos de lealtad pagados' en negativo". El
  schema solo tiene los **parámetros** del bono (`PlatformSettings.loyaltyBonusCents`,
  `loyaltyBonusEveryOrders`); no existe ningún modelo/ledger que registre bonos
  efectivamente pagados a clientes. Σ imposible de calcular.
- **Severidad**: mayor
- **Resolución recomendada**: decidir y escribir en spec: (a) agregar modelo
  `LoyaltyBonus { id, customerId, amountCents, orderCountAtGrant, createdAt }` en
  `spec/00` (aunque el otorgamiento viva en la app móvil futura, la web ya puede
  agregarlo), o (b) declarar en F5 §4 que `loyaltyBonusCents` es `0` hardcodeado con nota
  "fuera de alcance web" hasta que exista la app móvil. La opción (b) es la mínima
  coherente con el alcance "solo web".

### XC-07 — La tabla de `team` (F6) muestra "sucursal" del trabajador, pero `Worker` no tiene relación con `Branch`

- **Dimensión**: 1 (schema vs. consumo)
- **Specs**: `00-foundations.md` §3 (modelo `Worker`), `06-landing-polish.md` §2
- **Descripción**: F6 §2 pide "tabla (nombre, servicios asignados, **sucursal**)".
  `Worker` en F0 solo tiene `userId?, fullName, businessId, services`. No hay
  `branchId` ni m2m con `Branch`; la columna no puede poblarse.
- **Severidad**: mayor
- **Resolución recomendada**: agregar `Worker.branchId String?` + relación
  `Branch.workers Worker[]` en `spec/00` §3 (con `@@index([branchId])`), y en F6 §2
  incluir el Select de sucursal en el Sheet de alta/edición. Alternativa mínima: quitar
  la columna "sucursal" de F6 §2. Elegir una y escribirla.

### XC-08 — Retiros: Transfer vs. Payout contradictorio entre F3 y F5

- **Dimensión**: 2 (contratos entre fases) + 5 (dinero)
- **Specs**: `03-payments.md` §1 (diagrama: "admin aprueba (F5) ──▶ **Payout** Stripe"),
  `05-admin.md` §4 ("llama `approveWithdrawal` de F3 (**Transfer/Payout**)") y §7
  ("aprobar retiro de Plomería García → **Transfer** creado"),
  `00-foundations.md` §3 (`Withdrawal.stripeTransferId`), `README.md` (stack: "Connect (retiros)")
- **Descripción**: con *separate charges & transfers*, el **Transfer** a la cuenta
  Connect ya ocurre en `releasePayment` (F3 §1–2). Un retiro posterior debería ser un
  **Payout** desde el balance de la cuenta conectada — pero las cuentas **Express**
  (F3 §3) gestionan payouts automáticos por defecto, así que ni siquiera es claro que la
  plataforma deba/pueda crear el payout. Las tres specs usan los dos términos
  indistintamente y el campo se llama `stripeTransferId`, lo que llevará a
  implementaciones divergentes de `approveWithdrawal`.
- **Severidad**: mayor
- **Resolución recomendada**: fijar el modelo en F3 §1–2 (una sola frase normativa),
  recomendado: el Transfer se difiere hasta la aprobación del retiro — es decir,
  `releasePayment` solo marca `RELEASED` (saldo contable interno) y `approveWithdrawal`
  crea el Transfer por el monto retirado, con payouts automáticos de Express hacia el
  banco. Con ese modelo `Withdrawal.stripeTransferId` es correcto y F5 §7 queda válido.
  Ajustar el diagrama de F3 §1 (quitar "Payout Stripe") y la fila de README stack.

### XC-09 — Las verificaciones manuales de F5 asumen que los datos del seed tienen objetos Stripe reales

- **Dimensión**: 7 (seed vs. verificaciones) + 2 (contratos)
- **Specs**: `00-foundations.md` §9, `05-admin.md` §7, `03-payments.md` §2
- **Descripción**: F5 §7 pide "resolver la disputa URGENT con reembolso parcial →
  Payment `PARTIALLY_REFUNDED` y transfer del resto (**visible en Stripe test**)" y
  "aprobar retiro de Plomería García → **Transfer creado**". Pero los pagos y retiros del
  seed (F0 §9) son filas sembradas sin `stripePaymentIntentId` ni `stripeAccountId`
  reales: `refundPayment` (que llama `stripe.refunds.create`) y `approveWithdrawal`
  fallarían con `STRIPE_ERROR`. Además F0 §9 no garantiza que la disputa URGENT tenga un
  `Payment IN_ESCROW` asociado (solo dice "~15 órdenes … con pagos" y "2 disputas").
- **Severidad**: mayor
- **Resolución recomendada**: (a) en F0 §9 especificar que la disputa URGENT se siembra
  sobre una orden con `Payment IN_ESCROW`; (b) en F5 §7 reescribir la verificación
  Stripe-real como continuación del flujo manual de F3 §8 (link pagado con `4242…` →
  disputa creada a mano por Roger sobre ese pago), y dejar las verificaciones sobre seed
  limitadas a estados de BD; o (c) especificar en F3 §2 que `escrow.ts` trata
  `stripePaymentIntentId === null` como movimiento solo-contable (útil para seed/dev).
  Elegir (a)+(b) como mínimo.

### XC-10 — Verificación F2 "publicar el producto 51 en plan básico" es imposible con el seed de F0

- **Dimensión**: 7 (seed vs. verificaciones)
- **Specs**: `00-foundations.md` §9, `02-business-dashboard.md` §7
- **Descripción**: F2 §7 pide verificar "publicar el producto 51 en plan básico → toast
  `PLAN_LIMIT_REACHED`". El seed crea un único negocio ACTIVE ("Plomería García") en plan
  **standard** (productos ilimitados) y "~10 productos". No hay negocio en `basic` ni 50
  productos publicados; la verificación no puede ejecutarse. (El cambio de plan tampoco
  ayuda: `changePlan` llega en F4 y el downgrade validaría al revés.)
- **Severidad**: mayor
- **Resolución recomendada**: en F0 §9 agregar un negocio ACTIVE en plan `basic` (p.ej.
  "Ferretería El Tornillo", tipo PRODUCTS) con 50 productos `PUBLISHED` sembrados, y en
  F2 §7 apuntar la verificación a ese negocio. También sirve para probar el límite de
  sucursales (1) y trabajadores (3) del plan básico.

### XC-11 — Máquina de estados de `Dispute` incompleta: nadie transiciona `OPEN → IN_REVIEW`

- **Dimensión**: 4 (máquinas de estados)
- **Specs**: `00-foundations.md` §3 (`DisputeStatus { OPEN IN_REVIEW RESOLVED }`),
  `05-admin.md` §3
- **Descripción**: F5 §3 dice que `MORE_EVIDENCE` → "Dispute **permanece** IN_REVIEW",
  pero las disputas nacen `OPEN` (default F0) y ninguna spec define quién/cuándo pasa una
  disputa a `IN_REVIEW`. Además `admin.disputes.list` filtra por
  `status?: "open"|"resolved"` (2 valores) sin definir el mapeo del enum de 3 valores, y
  `dispute-list-item.tsx` pinta "Urgente rojo / **En revisión** ámbar / Resuelta gris",
  que mezcla urgencia con estado sin regla escrita. También queda ambiguo si
  `MORE_EVIDENCE` escribe `Dispute.resolution` (dejaría `resolution` no-nulo en una
  disputa no resuelta).
- **Severidad**: mayor
- **Resolución recomendada**: definir en F5 §3: `MORE_EVIDENCE` transiciona
  `OPEN|IN_REVIEW → IN_REVIEW` **sin** escribir `resolution` (solo las 3 resoluciones
  monetarias la persisten); filtro `"open"` = `status IN (OPEN, IN_REVIEW)`; regla visual:
  rojo si `urgency=URGENT` y no resuelta, ámbar si `IN_REVIEW`, gris si `RESOLVED`. Ver
  ticket `XC-11-dispute-status-transitions.md`.

---

## Menores

### XC-12 — `BUSINESS_NOT_ACTIVE` está en `ERROR_CODES` pero ninguna spec lo usa

- **Dimensión**: 3 (códigos de error)
- **Specs**: `00-foundations.md` §4 y §5
- **Descripción**: F0 §4 declara `BUSINESS_NOT_ACTIVE` en `ERROR_CODES`, pero F0 §5
  especifica que `activeBusinessProcedure` lanza "`TRPCError` FORBIDDEN" cuando
  `business.status !== ACTIVE`. Ninguna otra spec cita `BUSINESS_NOT_ACTIVE`; queda
  muerto y la UI pierde la posibilidad de distinguir "cuenta pendiente/suspendida" de un
  403 genérico (F0 §5 dice "la UI muestra estado PENDING/SUSPENDED" — con FORBIDDEN no
  puede saberlo).
- **Severidad**: menor
- **Resolución recomendada**: en F0 §5, `activeBusinessProcedure` debe mapear a
  `BUSINESS_NOT_ACTIVE` (status 403) en el helper cliente que ya traduce
  UNAUTHORIZED/FORBIDDEN, o eliminar el código del array. Recomendado: usarlo.

### XC-13 — `papaparse` no está en ninguna lista de instalación

- **Dimensión**: 8 (paquetes)
- **Specs**: `00-foundations.md` §2, `02-business-dashboard.md` §3 ("el archivo se parsea
  en el cliente (`papaparse`)")
- **Severidad**: menor
- **Resolución recomendada**: agregar `papaparse` + `@types/papaparse` (dev) a F0 §2, o
  una sección "Dependencias de la fase" en F2. Ver ticket
  `XC-13-missing-deps-and-env.md`.

### XC-14 — `react-hook-form` + `@hookform/resolvers` no se instalan en ninguna fase

- **Dimensión**: 8 (paquetes)
- **Specs**: `00-foundations.md` §2, `02-business-dashboard.md` §2
  (`service-form-fields.tsx` "recibe **register/errors**" — API de react-hook-form),
  `05-admin.md` §5 (`settings-view.tsx` "react-hook-form + **zodResolver**")
- **Descripción**: `zodResolver` vive en `@hookform/resolvers`; ninguno de los dos
  paquetes aparece en F0 §2 ni en otra fase. El componente shadcn `form` (que los
  instalaría) tampoco está en la lista de F0 §2.
- **Severidad**: menor
- **Resolución recomendada**: agregar ambos a F0 §2 (o `form` a la lista shadcn). Ver
  ticket `XC-13-missing-deps-and-env.md`.

### XC-15 — Componentes shadcn usados y no listados en F0: `alert`, `slider`, `radio-group`

- **Dimensión**: 8 (paquetes)
- **Specs**: `00-foundations.md` §2; `03-payments.md` §3/§6 (`Alert` del banner de
  onboarding), `04-subscriptions.md` §2 (banner PAST_DUE), `05-admin.md` §5
  ("umbral (**slider**+input)", "switches + **radios** del diseño")
- **Severidad**: menor
- **Resolución recomendada**: agregar `alert slider radio-group` a la lista de
  componentes de F0 §2. Ver ticket `XC-13-missing-deps-and-env.md`.

### XC-16 — El placeholder de landing de F0 chocará con `(public)/page.tsx` de F6

- **Dimensión**: 6 (rutas)
- **Specs**: `00-foundations.md` §1 ("`src/app/page.tsx` se moverá bajo `[locale]` …
  placeholder de landing hasta F6"), `01-auth.md` §4 (grupo `(public)`),
  `06-landing-polish.md` §1 (`[locale]/(public)/page.tsx`)
- **Descripción**: si F0 deja el placeholder en `[locale]/page.tsx` y F6 crea
  `[locale]/(public)/page.tsx`, ambos resuelven `/` → error de build de Next.js
  ("parallel pages"). F6 no dice explícitamente que borra/mueve el placeholder.
- **Severidad**: menor
- **Resolución recomendada**: en F0 §1 especificar la ruta del placeholder como
  `[locale]/(public)/page.tsx` desde el inicio (el grupo lo crea F0 y F1/F6 lo reusan).

### XC-17 — `CRON_SECRET` (F3) falta en la lista de env del README y en `env.js` de F0

- **Dimensión**: 8 (paquetes/env) + 2
- **Specs**: `03-payments.md` §5 ("route handler `api/cron/release-escrow` protegido por
  `CRON_SECRET` (header)"), `README.md` ("Variables `.env` requeridas"),
  `00-foundations.md` §8
- **Severidad**: menor
- **Resolución recomendada**: agregar `CRON_SECRET` a README (lista de env), a F0 §8
  (`src/env.js` server) y a `.env.example`. Ver ticket `XC-13-missing-deps-and-env.md`.
  Nota adjunta: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` se exige en F0 §8 pero ninguna spec
  la consume (checkout y onboarding son hosted); mantenerla es inocuo, pero conviene
  anotarlo o quitarla.

### XC-18 — Badge de estados de pago (W6) cita "Pagado", que no mapea a ningún `PaymentStatus`, y omite `PARTIALLY_REFUNDED`

- **Dimensión**: 4 (estados)
- **Specs**: `00-foundations.md` §3 (`PaymentStatus { PENDING IN_ESCROW RELEASED
  REFUNDED PARTIALLY_REFUNDED }`), `03-payments.md` §6 (`payment-status-badge.tsx`:
  "En escrow (ámbar) · **Pagado (azul)** · Liberado (verde) · Reembolsado (gris)")
- **Descripción**: "Pagado" no corresponde a ningún valor del enum (¿`PENDING`? ese es
  pre-cobro). Tras F5, la tabla de W6 mostrará pagos `PARTIALLY_REFUNDED` sin variante
  definida. `status-badge.tsx` de F0 §7 exige "mapa estado→variante **tipado por
  unión**", así que el mapa incompleto ni compila ni se puede improvisar.
- **Severidad**: menor
- **Resolución recomendada**: en F3 §6 definir el mapa completo de 5 valores:
  `PENDING` → "Pendiente (gris)", `IN_ESCROW` ámbar, `RELEASED` verde, `REFUNDED` gris,
  `PARTIALLY_REFUNDED` → "Reembolso parcial (azul)". Eliminar "Pagado".

### XC-19 — Estado final de `Order` sin definir para `PARTIAL_REFUND` y `RELEASE_PAYMENT`

- **Dimensión**: 4 (estados)
- **Specs**: `00-foundations.md` §3 (`OrderStatus`), `05-admin.md` §3 (tabla de
  resoluciones: solo `FULL_REFUND` fija "Order CANCELLED")
- **Descripción**: una orden en disputa está `DISPUTED`. La tabla de F5 §3 define el
  estado del `Payment` para cada resolución pero el del `Order` solo en `FULL_REFUND`.
  ¿`PARTIAL_REFUND`/`RELEASE_PAYMENT` regresan la orden a `COMPLETED`? Sin regla, cada
  implementación decidirá distinto y los KPIs de F2 (que cuentan órdenes por estado)
  divergen.
- **Severidad**: menor
- **Resolución recomendada**: completar la tabla de F5 §3: `PARTIAL_REFUND` y
  `RELEASE_PAYMENT` → `Order COMPLETED`; `MORE_EVIDENCE` → permanece `DISPUTED`.

### XC-20 — `ctx.business.plan` es null para negocios PENDING/sin suscripción y ningún consumidor lo contempla

- **Dimensión**: 2 (contratos) + 1
- **Specs**: `00-foundations.md` §5 (select de `businessProcedure` incluye
  `subscription.plan`), `01-auth.md` §2 ("un negocio PENDING no tiene plan"),
  `02-business-dashboard.md` §3 (`assertPlanLimit` lee `ctx.business.plan.maxProducts`),
  `03-payments.md` §1 (comisión "leyendo el plan vigente"), `README.md` §Jerarquía
  ("ctx.business (id, plan, status)")
- **Descripción**: `Subscription` es opcional (`Business.subscription Subscription?`) y
  F1 confirma que PENDING no tiene plan. El tipo real de `ctx.business.plan` es
  `Plan | null`, pero README y los consumidores (límites F2/F4, comisión F3) lo tratan
  como no-nulo. Un negocio PENDING sí pasa `businessProcedure` (solo `active*` filtra
  status), p.ej. en `payment.getBalances` o `subscription.getCurrent`.
- **Severidad**: menor
- **Resolución recomendada**: en F0 §5 tipar explícitamente
  `ctx.business.plan: Plan | null` y añadir la regla: toda lógica que necesite plan
  (límites, comisión) corre bajo `activeBusinessProcedure` **y** además F5
  `approveBusiness` garantiza el invariante "ACTIVE ⇒ tiene suscripción" (documentarlo en
  F5 §2); con eso el narrowing es seguro.

### XC-21 — Definiciones de agregados financieros vagas o divergentes entre W3, W9 y W12

- **Dimensión**: 5 (dinero)
- **Specs**: `02-business-dashboard.md` §1, `05-admin.md` §1 ("GMV = Σ pagos del mes
  (**todos los estados cobrados**)") y §4 (`subscriptionCents` sin fuente definida)
- **Descripción**: "todos los estados cobrados" no enumera estados (¿incluye `REFUNDED`?
  ¿resta `refundedCents`?). `subscriptionCents` de W12 no dice de dónde sale (Σ
  `Invoice PAID` del mes es lo natural, pero no está escrito). Nombres inconsistentes
  para el mismo dato: F2 `escrowOrders`, F3 `escrowOrdersCount`, F5 `escrowOrders`.
- **Severidad**: menor
- **Resolución recomendada**: en F5 §1 definir
  `GMV = Σ amountCents de Payment con status ∈ {IN_ESCROW, RELEASED, REFUNDED, PARTIALLY_REFUNDED} del mes`
  (bruto, sin restar refunds — y decirlo); en F5 §4 `subscriptionCents = Σ Invoice.amountCents
  con status PAID emitidas en el mes`; unificar el nombre `escrowOrdersCount` en F2/F3/F5.

### XC-22 — F4 redefine la semántica de `activeBusinessProcedure` sin tocar F0

- **Dimensión**: 2 (contratos)
- **Specs**: `00-foundations.md` §5 (guarda = solo `business.status === ACTIVE`),
  `04-subscriptions.md` §2 ("`CANCELED` degrada el negocio a solo-lectura (las mutations
  de `activeBusinessProcedure` validan suscripción activa)")
- **Descripción**: F4 asume que la guarda compartida de F0 valida además
  `subscription.status !== CANCELED`, pero F0 §5 no lo contempla y F4 no declara que
  modifica `src/server/api/trpc.ts`. Riesgo de que F4 lo implemente como check disperso
  por mutation.
- **Severidad**: menor
- **Resolución recomendada**: en F4 §2 declarar explícitamente "modifica
  `activeBusinessProcedure` en `trpc.ts`: agrega el check de suscripción no-CANCELED",
  y en F0 §5 dejar la nota "(F4 extiende esta guarda)".

### XC-23 — W10 muestra "documentos" del negocio que el schema no almacena

- **Dimensión**: 1 (schema vs. consumo)
- **Specs**: `00-foundations.md` §3 (modelo `Business`), `05-admin.md` §2
  (`getBusinessDetail` → "perfil completo: garantía, **docs**, órdenes, disputas";
  `business-detail-sheet.tsx` "perfil + **documentos** + historial")
- **Descripción**: no existe ningún campo/modelo para documentos de garantía
  (`Business` solo tiene `guaranteeType` + `guaranteeNotes`). `Dispute.evidenceUrls`
  es de disputas, no del negocio.
- **Severidad**: menor
- **Resolución recomendada**: agregar `Business.documentUrls String[]` (default `[]`) en
  `spec/00` §3, o reescribir F5 §2 quitando "docs/documentos" del detalle (el registro F1
  tampoco sube documentos, así que la opción mínima es quitarlos y dejar
  `guaranteeNotes`).

### XC-24 — El seed no siembra `Withdrawal` con banco explícito ni las specs fijan dato de rating exacto (consistencia de verificación, agregado)

- **Dimensión**: 7 (seed) — hallazgo agregado de baja prioridad
- **Specs**: `00-foundations.md` §9, `02-business-dashboard.md` §7
- **Descripción**: F2 §7 pide "KPIs de 'Plomería García' coinciden con los datos
  sembrados", pero F0 §9 usa cantidades aproximadas ("~10 productos", "~15 órdenes",
  "rating ≈ 4.9"), imposibles de verificar con exactitud. Menor porque la verificación es
  manual/visual, pero conviene fijar cifras exactas en el seed para que "coinciden" sea
  comprobable.
- **Severidad**: menor
- **Resolución recomendada**: en F0 §9 sustituir los "~" por cantidades exactas (p.ej.
  10 productos, 15 órdenes, 12 reseñas → rating 4.9) y anotar en F2 §7 los valores
  esperados de los 4 KPIs.

---

## Dimensiones verificadas sin hallazgo

- **Schema**: `Dispute.aiSummary`, `Payment.commissionPctApplied/commissionCents/
  escrowReleaseAt/stripeTransferId`, `PaymentLink.paidAt`, `Withdrawal.stripeTransferId`,
  m2m `Worker↔Service`, `Order.recordingUrl` — todos existen en F0 con tipo coherente.
- **Contratos**: `releasePayment`/`refundPayment` (F3→F5), `approveWithdrawal`/
  `rejectWithdrawal` (F3→F5), `checkDowngradeFit` (F4) — nombres y semántica alineados
  (salvo XC-08 sobre Transfer/Payout).
- **Dinero**: retiros `REJECTED` correctamente excluidos del descuento de disponible
  (F3 §1 + test §7); comisión congelada citada igual en F0 §3, F3 §1/§7, F4 §criterios y
  F5 §5/§criterios.
- **Estados**: `PARTIALLY_REFUNDED` sí existe en el enum de F0 (citado por F5);
  `WithdrawalStatus` y `SubscriptionStatus` consistentes en todas las specs.
- **i18n/rutas**: namespaces (`common/landing/auth/dashboard/admin/errors`) cubren todo
  lo citado (`auth.mobileOnly`, `landing.json`, `errors.json`); páginas bajo `[locale]`,
  APIs (`api/auth`, `api/trpc`, `api/webhooks`, `api/cron`) fuera del locale en todas las
  specs (salvo XC-16).
- **Seed↔F1/F2/F5**: admin `admin@home360.mx`, "Plomería García" ACTIVE/standard,
  "Eléctrica Volta" PENDING, "Clima Norte MX" suspendido, disputa URGENT con `aiSummary`,
  2 retiros REQUESTED — todos los actores de las verificaciones existen (salvo lo
  señalado en XC-09/XC-10/XC-24).
- **Paquetes**: `stripe`, `bcryptjs`+`@types/bcryptjs`, `next-intl`, `recharts`,
  `vitest`, `tsx`, `lucide-react` (via shadcn), `sonner` (componente shadcn listado),
  Magic UI (registry F6) — cubiertos.
