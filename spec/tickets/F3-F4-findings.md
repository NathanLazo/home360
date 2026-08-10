# F3 + F4 — Hallazgos de la revisión de specs (pagos y suscripciones)

Revisión de `spec/03-payments.md` y `spec/04-subscriptions.md` contra `spec/00-foundations.md`,
`spec/02-business-dashboard.md`, `spec/05-admin.md`, los tickets ya escritos
(`F3-01`…`F3-13`, `F4-01`…`F4-11`) y las resoluciones previas de `XC-findings.md` y
`F0-findings.md` (fecha: 2026-07-30).

**Severidades**: **bloqueante** (contradicción que impide implementar o corrompe dinero),
**mayor** (hueco que un agente no puede resolver sin inventar), **menor** (inconsistencia
puntual, fix acotado).

**Estado**: *resuelto en ticket* = ya hay una decisión implementable escrita, pero la spec
sigue diciendo otra cosa y Roger debe validarla; *abierto* = requiere decisión de Roger
antes de implementar.

Los hallazgos ya documentados en `XC-findings.md` **no se re-analizan**: se citan como
"ya cubierto en XC-NN" y solo se añade lo que la revisión de F3/F4 agrega encima.

## Índice

| # | Hallazgo | Severidad | Spec(s) | Estado | Ticket |
|---|----------|-----------|---------|--------|--------|
| 1 | `Payment` sin `paymentLinkId` ni `businessId` | bloqueante | 00, 03 | resuelto | F3-01 |
| 2 | "Disponible" bruto vs. neto | bloqueante | 03, 02, 05 | resuelto | F3-06 |
| 3 | `Business.stripeCustomerId` diferido a la migración de F4 | menor | 00, 04 | resuelto | F4-01 |
| 4 | Retiros: Transfer vs. Payout y `Withdrawal.stripeTransferId` | mayor | 03, 05, 00 | resuelto (diverge de XC-08) | F3-02, F3-07 |
| 5 | W6 necesita el estado de la cuenta Connect y §4 no lo expone | menor | 03 | resuelto | F3-13 |
| 6 | Auto-liberación de escrow ignora disputas abiertas | mayor | 03, 05 | resuelto | F3-04 |
| 7 | Comisión en reembolso parcial y reembolso de pagos `RELEASED` | mayor | 03, 05 | resuelto (política provisional) | F3-05 |
| 8 | Agregados de F2/F5 no contemplan neto ni `PARTIALLY_REFUNDED` | mayor | 02, 03, 05 | abierto | — |
| 9 | Los links de cobro caducan (Checkout Session 24 h) | menor | 03 | abierto | F3-08 |
| 10 | Comisión cuando el negocio no tiene suscripción al capturar | mayor | 03, 04 | resuelto (fallback provisional) | F3-03 |
| 11 | `Business` sin `chargesEnabled`/`payoutsEnabled` | mayor | 00, 03 | resuelto | F3-01 |
| 12 | Forma de `ctx.business.plan` divergente entre F0-05 y F2-02 | mayor | 00, 02, 04 | resuelto | F4-02 |
| 13 | **No existe recolección de método de pago para Billing** | bloqueante | 04 | **cerrado**: Customer Portal (`PENDIENTES.md` §8) | F4-03, F4-06 |
| 14 | `PLAN_LIMIT_REACHED` "con detalle" contradice el contrato | mayor | 04, 00 | resuelto | F4-04, F4-06, F4-09 |
| 15 | Suscripción cancelada → 403 indistinguible | menor | 00, 04 | resuelto | F4-07 |
| 16 | Nadie puede cancelar ni reactivar una suscripción | mayor | 04, 05 | **cerrado**: opción (a), vía Portal | F4-03, F4-06 |
| 17 | Payload de `Invoice` dependiente de `apiVersion` de Stripe | menor | 04, 00 | resuelto | F4-05 |
| 18 | "Solo-lectura" no está definido en la UI | menor | 04 | abierto | F4-07 |
| 19 | Facturación fiscal mexicana (IVA/CFDI) no modelada | mayor | 04 | abierto | — |
| 20 | `Subscription` sin campos de ciclo ni de cancelación programada | menor | 00, 04 | abierto | — |
| 21 | `Invoice` se borra en cascada y W12 pierde histórico | menor | 00, 05 | abierto | — |
| 22 | Precios de planes duplicados entre BD, seed y landing | menor | 04, 06 | abierto | — |
| 23 | `previewChange`/`changePlan` sin definir cuándo se cobra el prorrateo | menor | 04 | resuelto | F4-04, F4-09 |
| 24 | Rotación de `Price` deja suscripciones vivas en un precio viejo | menor | 04 | resuelto parcialmente | F4-01, F4-05 |

---

## Detalle

### 1. `Payment` sin `paymentLinkId` ni `businessId` — **bloqueante** (resuelto en F3-01)

- **Specs**: `00` §3 (`Payment`), `03` §1, §2, §5, §6.
- La parte de `orderId`/`paymentLinkId` **ya está cubierta en XC-01**. Lo que agrega esta
  revisión: `Payment` tampoco tiene `businessId`, y `03` §1 exige derivar los tres saldos
  "en una sola pasada de agregaciones". Sin denormalizar el tenant, cada agregación tendría
  que unir por dos padres distintos (`Order` o `PaymentLink`) y ningún índice sirve.
- **Resolución (F3-01)**: `orderId` opcional + `paymentLinkId String? @unique` +
  `businessId String` (fijado al capturar, inmutable) con
  `@@index([businessId, status])` y `@@index([businessId, createdAt])`.
- **Recomendación**: aplicar el bloque Prisma en `spec/00` §3 y citar `Payment.businessId`
  en `spec/03` §1 al describir los saldos.

### 2. "Disponible" bruto vs. neto — **bloqueante** (resuelto en F3-06)

- **Specs**: `03` §1, §7; `02` §1; `05` §4.
- **Ya cubierto en XC-03**. Lo que agrega esta revisión: la fórmula canónica adoptada por
  los tickets es
  `disponible = Σ_{RELEASED, PARTIALLY_REFUNDED}(amountCents − commissionCents − refundedCents) − Σ_{REQUESTED, APPROVED} withdrawal.amountCents`,
  y `monthCommissionCents` excluye los `REFUNDED` totales (la plataforma no gana comisión
  sobre un pago devuelto por completo) pero **sí** cuenta la comisión íntegra de los
  parciales (coherente con el hallazgo #7).
- **Recomendación**: escribir esas dos fórmulas literalmente en `spec/03` §1.

### 3. `Business.stripeCustomerId` diferido a la migración de F4 — **menor** (resuelto en F4-01)

- **Specs**: `04` §2, §7; `00` §3.
- **Ya cubierto en `F0-findings.md` B2**. `spec/04` agrega la columna en su propia migración
  (`add_stripe_customer_id`), lo que obliga a una segunda migración de un campo opcional
  inofensivo y bloquea `approveBusiness` de F5 si F5 corre antes que F4 (relacionado con
  XC-02).
- **Recomendación**: mover la columna a `spec/00` §3 (F0-03) y dejar en `spec/04` §7 solo el
  `sync-stripe-plans`. Si F0 ya migró, F4-01 la agrega tal como está escrito.

### 4. Retiros: Transfer vs. Payout — **mayor** (resuelto en F3-02/F3-07, **diverge de XC-08**)

- **Specs**: `03` §1–§2, `05` §4 y §7, `00` §3 (`Withdrawal.stripeTransferId`), `README`.
- **Ya cubierto en XC-08**, pero los tickets de F3 adoptaron la opción **contraria** a la
  recomendada allí, y conviene que Roger lo sepa antes de tocar las specs:
  - XC-08 recomendaba *diferir* el Transfer hasta la aprobación del retiro.
  - `F3-04`/`F3-07` implementan el modelo del diagrama de `03` §1: **Transfer al liberar el
    escrow** (es la única vía de mover dinero al negocio, requisito de `03` §2 y de las
    disputas de F5) y **Payout desde la cuenta conectada al aprobar el retiro**, posible
    porque `F3-02` crea la cuenta Express con `payouts.schedule.interval = "manual"`.
  Motivo de la divergencia: con el modelo de XC-08, `releasePayment` dejaría de mover dinero
  y F5 (`resolve-dispute`) quedaría sin efecto real sobre Stripe.
- **Consecuencia menor no resuelta**: `Withdrawal.stripeTransferId` guarda un **Payout id**;
  el campo queda mal nombrado (no se renombra para no re-migrar).
- **Recomendación**: fijar en `spec/03` §1–§2 una frase normativa con el modelo elegido,
  corregir `05` §4/§7 ("Transfer" → "Payout") y anotar el nombre heredado del campo (o
  renombrarlo a `stripePayoutId` en la misma migración de F3-01, decisión de Roger).

### 5. W6 necesita el estado de la cuenta Connect y `03` §4 no lo expone — **menor** (resuelto en F3-13)

- **Specs**: `03` §3, §4, §6.
- `03` §3 y §6 exigen mostrar el banner de onboarding "si falta `stripeAccountId`" y
  deshabilitar el retiro cuando no hay payouts habilitados, pero la tabla de procedures de
  §4 no tiene ninguna lectura que devuelva ese estado.
- **Resolución (F3-13)**: se agrega `payment.getConnectStatus` (`businessProcedure`) →
  `{ hasAccount, chargesEnabled, payoutsEnabled }`.
- **Recomendación**: añadir la fila a la tabla de `spec/03` §4.

### 6. Auto-liberación de escrow ignora disputas abiertas — **mayor** (resuelto en F3-04)

- **Specs**: `03` §5 (auto-liberación), `05` §3 (resoluciones de disputa).
- `03` §5 libera todo `Payment` con `escrowReleaseAt <= now`. Una orden en disputa
  (`DISPUTED`, resolución pendiente) se pagaría al negocio automáticamente a las 72 h,
  dejando a la plataforma sin fondos retenidos para reembolsar al cliente: el reembolso de
  F5 (`refundPayment` sobre pagos `IN_ESCROW`) sería imposible.
- **Resolución (F3-04)**: `releaseDuePayments` excluye pagos cuya orden tenga `Dispute` con
  `status !== RESOLVED`, y `releasePayment` responde `DISPUTE_OPEN`.
- **Recomendación**: escribirlo en `spec/03` §5 y anotar en `spec/05` §3 que abrir una
  disputa congela la auto-liberación.

### 7. Comisión en reembolso parcial y reembolso de pagos `RELEASED` — **mayor** (resuelto provisionalmente en F3-05)

- **Specs**: `03` §1, `05` §3.
- Ninguna spec define (a) si la plataforma conserva la comisión cuando el cliente recibe un
  reembolso parcial, ni (b) qué pasa si la disputa se resuelve **después** de que el pago se
  liberó (el dinero ya está en la cuenta del negocio: haría falta un *transfer reversal*).
- **Resolución provisional (F3-05)**: la plataforma **conserva la comisión completa**, por
  lo que el reembolso parcial se topa en `amountCents − commissionCents`; reembolsar un pago
  `RELEASED` se rechaza con `CONFLICT` (fuera de alcance de F3).
- **Abierto para Roger**: ¿comisión proporcional al monto no reembolsado? ¿se implementa
  reversal en alguna fase? Ambas decisiones cambian las fórmulas del hallazgo #2.

### 8. Agregados de F2/F5 no contemplan neto ni `PARTIALLY_REFUNDED` — **mayor** (abierto)

- **Specs**: `02` §1 (revenue del negocio), `03` §1, `05` §1 (GMV) y §4 (breakdown).
- **Parcialmente cubierto en XC-03 y XC-21**. Lo que agrega esta revisión: tras fijar las
  fórmulas netas de F3-06, los KPIs de W3 (`02` §1: "revenue = pagos `IN_ESCROW|RELEASED`")
  y los de W9/W12 siguen escritos en bruto y sin `PARTIALLY_REFUNDED`, así que **tres
  pantallas mostrarán tres números distintos para el mismo mes** en cuanto exista una
  disputa parcial. Ningún ticket de F3/F4 puede arreglarlo: son specs de otras fases.
- **Recomendación**: definir en `spec/03` §1 dos conceptos con nombre propio
  (`grossPaid` y `netToBusiness`) y que `02` §1, `05` §1 y `05` §4 los citen explícitamente
  en vez de redefinir sumas. Unificar además `escrowOrders` / `escrowOrdersCount`.

### 9. Los links de cobro caducan — **menor** (abierto, señalado en F3-08)

- **Specs**: `03` §2, §6.
- El servicio usa Checkout Sessions, que expiran (24 h máx.). La UI de W6 muestra una URL
  copiable que el negocio puede compartir por WhatsApp días después; el link fallará sin
  aviso y `PaymentLink` no tiene `expiresAt` ni estado de expiración.
- **Recomendación (decisión de Roger)**: (a) usar la **Payment Links API** de Stripe (no
  expiran) en vez de Checkout Sessions, o (b) persistir `expiresAt` y mostrar el estado
  "expirado" en la tabla + acción "regenerar". La opción (a) es menos código y más fiel al
  caso de uso.

### 10. Comisión cuando el negocio no tiene suscripción al capturar — **mayor** (resuelto provisionalmente en F3-03)

- **Specs**: `03` §1, `04` §2, `00` §5.
- La comisión se congela "leyendo el plan vigente", pero un negocio puede estar `PENDING`
  (sin suscripción, `01` §2) o `CANCELED` (`04` §2) y aun así recibir el pago de un link
  emitido antes. `ctx.business.plan` es nullable (XC-20) y la spec no da fallback.
- **Resolución provisional (F3-03)**: se aplica el `commissionPct` del plan `basic` (el más
  alto) y se documenta en el código.
- **Abierto para Roger**: alternativas razonables son un `defaultCommissionPct` en
  `PlatformSettings` (configurable desde W13, coherente con `05` §5) o rechazar el cobro.
  Recomendado: el campo en `PlatformSettings`.

### 11. `Business` sin `chargesEnabled`/`payoutsEnabled` — **mayor** (resuelto en F3-01)

- **Specs**: `00` §3 (`Business`), `03` §5 (`account.updated` "refresca la capacidad de
  payouts del negocio"), `03` §3.
- No existe columna donde persistir la capacidad de la cuenta Connect, así que el webhook no
  tendría efecto y W6 no podría decidir si permite retirar sin consultar Stripe en cada
  render.
- **Resolución (F3-01)**: `chargesEnabled Boolean @default(false)` y
  `payoutsEnabled Boolean @default(false)` en `Business`, sincronizados por
  `account.updated` (F3-09) y por `getAccountStatus` (F3-02).
- **Recomendación**: agregar ambos campos al bloque Prisma de `spec/00` §3.

### 12. Forma de `ctx.business.plan` divergente entre tickets — **mayor** (resuelto en F4-02)

- **Specs**: `00` §5, `02` §3, `04` §3.
- **Relacionado con XC-20 y `F0-findings.md` A3**, pero es un problema nuevo *entre
  tickets*: `F0-05` aplana el contexto a `{ id, status, plan: PlanLimits | null }` mientras
  `F2-02` tipa el servicio de límites con `{ id, subscription: { plan } | null }`. Si F2 se
  implementó literal, `assertPlanLimit` no acepta el `ctx` real sin castear — justo lo que
  su propio criterio de aceptación prohíbe.
- **Resolución (F4-02)**: la forma canónica es la de `F0-05`; al completar `plan-limits.ts`
  se adapta el tipo (no se crea uno paralelo).
- **Recomendación**: en `spec/02` §3 y `spec/04` §3 escribir `ctx.business.plan`
  (aplanado, nullable) en vez de `ctx.business.subscription.plan`.

### 13. No existe recolección de método de pago para Billing — **bloqueante** (paliativo en F4-03)

- **Specs**: `04` §2, §5, §7; `README` (stack: "Stripe Billing").
- Ninguna spec define **dónde paga el negocio su suscripción**: W7 solo tiene cards,
  prorrateo y facturas; no hay Stripe Elements, ni Checkout de suscripción, ni Billing
  Customer Portal, y `04` §7 propone provocar la mora con la tarjeta `4000…0341` — una
  tarjeta que nadie puede capturar en la app. Con `collection_method: "charge_automatically"`
  y sin payment method, la suscripción nace `incomplete` y **jamás cobra**: toda la fase
  quedaría decorativa.
- **Resolución paliativa (F4-03)**: la suscripción se crea con
  `collection_method: "send_invoice"` + `days_until_due: 7`; Stripe envía la factura hosted
  al correo del dueño y el flujo `invoice.paid` / `PAST_DUE` funciona tal como está escrito.
- **Recomendación (decisión de Roger)**: agregar a `spec/04` §4 una procedure
  `subscription.createPortalSession` (`activeBusinessProcedure` →
  `stripe.billingPortal.sessions.create` → `{ url }`) y conectarla al botón "Administrar
  plan" de §5. Resuelve método de pago, cambio de tarjeta, cancelación (#16) y descarga de
  facturas con una sola pantalla hosted, sin capturar datos de tarjeta en HOME360. Es la
  opción recomendada; hasta entonces `04` §7 debe reescribir su verificación manual.

### 14. `PLAN_LIMIT_REACHED` "con detalle" contradice el contrato — **mayor** (resuelto en F4-04/F4-06/F4-09)

- **Specs**: `04` §2 y §4 ("`PLAN_LIMIT_REACHED` (con `exceeds`)"), `00` §4.
- `TrpcResponse` es `{ result: null, error: code, status, message }`: un fallo **no puede**
  transportar `exceeds`. Y `message` es texto de referencia en inglés que la UI nunca
  muestra.
- **Resolución (F4-04/F4-06)**: `previewChange` devuelve `{ fits, exceeds, prorationCents,
  effectiveAt }` como **resultado exitoso**; el diálogo (F4-09) usa ese detalle y `changePlan`
  solo falla con el código.
- **Recomendación**: corregir la tabla de `spec/04` §4 (mover `exceeds` a `previewChange`).

### 15. Suscripción cancelada → 403 indistinguible — **menor** (resuelto en F4-07)

- **Specs**: `00` §5, `04` §2.
- **Ya cubierto en XC-12 y XC-22** (el código `BUSINESS_NOT_ACTIVE` existe pero nadie lo
  usa; F4 extiende la guarda sin declararlo). Lo que agrega esta revisión: `F0-05` ya fijó
  que las guardas solo lanzan `UNAUTHORIZED`/`FORBIDDEN`, así que F4-07 mantiene ese canal y
  la UI distingue el motivo por `subscription.getCurrent` (accesible con
  `businessProcedure`, que sí pasa un negocio cancelado).
- **Recomendación**: en `spec/04` §2 declarar explícitamente "modifica
  `activeBusinessProcedure` en `trpc.ts`" y en `spec/00` §5 dejar la nota "(F4 extiende esta
  guarda con el estado de la suscripción)".

### 16. Nadie puede cancelar ni reactivar una suscripción — **mayor** (abierto)

- **Specs**: `04` §2, §4, §5; `05` §2.
- `04` §2 describe qué ocurre **cuando** la suscripción se cancela, pero ninguna procedure
  la cancela y ninguna la reactiva: `customer.subscription.deleted` solo puede originarse en
  el Dashboard de Stripe. Un negocio `CANCELED` queda en solo-lectura **para siempre** desde
  la web, y `05` §2 (`suspendBusiness`/`reactivateBusiness`) no toca Billing.
- **Recomendación (decisión de Roger)**: (a) Billing Portal (ver #13) cubre cancelar y
  reactivar sin código nuevo; (b) si se quiere en la app: `subscription.cancel`
  (`cancel_at_period_end: true`) + `subscription.resume`, más el campo del hallazgo #20; o
  (c) declarar explícitamente en `04` §2 que la cancelación es una operación de soporte
  fuera de producto. Elegir una y escribirla.

### 17. Payload de `Invoice` dependiente de `apiVersion` — **menor** (resuelto en F4-05)

- **Specs**: `04` §2, `00` §8 (`apiVersion` fijada en el singleton de Stripe).
- El id de la suscripción cambió de lugar dentro del objeto `Invoice` entre versiones de la
  API de Stripe (`invoice.subscription` → `invoice.parent.subscription_details.subscription`),
  y la spec da por hecho un campo estable. Con TypeScript estricto, escribir el handler
  contra la versión equivocada no compila.
- **Resolución (F4-05)**: helper único `resolveInvoiceSubscriptionId` + fallback por
  `customer` → `Business.stripeCustomerId`.
- **Recomendación**: fijar y documentar la `apiVersion` exacta en `spec/00` §8 para que
  todos los handlers se escriban contra el mismo contrato.

### 18. "Solo-lectura" no está definido en la UI — **menor** (abierto)

- **Specs**: `04` §2.
- "`CANCELED` degrada el negocio a solo-lectura" está garantizado en el servidor (F4-07),
  pero la spec no dice qué hace la interfaz: los botones "Nuevo servicio", "Crear link de
  cobro", "Retirar", etc. seguirán visibles y fallarán con un toast 403.
- **Recomendación**: definir en `04` §2 (o en `02` §0, que es donde vive el shell) que el
  layout expone el estado de suscripción y que los módulos deshabilitan sus acciones
  primarias con tooltip cuando es `CANCELED`. Es un barrido transversal (candidato natural
  a F6-12, "quality states sweep").

### 19. Facturación fiscal mexicana (IVA/CFDI) no modelada — **mayor** (abierto)

- **Specs**: `04` §1 (precios), `05` §4 (ingresos por suscripción), `00` §3 (`Invoice`).
- Los precios ($499/$999/$1,999) no declaran si incluyen IVA, `Invoice` no tiene desglose de
  impuestos y no existe nada de CFDI (RFC, uso, régimen), obligatorio para que un negocio
  mexicano deduzca su suscripción. Lo mismo aplica a la comisión de la plataforma sobre cada
  pago (F3).
- **Recomendación**: decidir y escribir en `spec/04` §1 al menos si los precios son con IVA
  incluido, y declarar CFDI explícitamente **fuera de alcance** de la web (o abrir una fase
  aparte con un proveedor de timbrado). Sin esa línea, cada implementador asumirá algo
  distinto.

### 20. `Subscription` sin campos de ciclo ni de cancelación programada — **menor** (abierto)

- **Specs**: `00` §3, `04` §2.
- `Subscription` solo tiene `renewsAt` (no-null). Faltan: `currentPeriodStart` (para mostrar
  el periodo facturado), `cancelAtPeriodEnd` (para "tu plan termina el X", único modo
  civilizado de cancelar) y `canceledAt`. Además `renewsAt` es obligatorio pero
  `approveBusiness` (F5-05) lo escribe como `now + 1 mes` **antes** de saber el periodo real
  de Stripe, que luego lo corrige por webhook: durante ese hueco el dato es mentira.
- **Recomendación**: agregar `cancelAtPeriodEnd Boolean @default(false)` y
  `canceledAt DateTime?` a `spec/00` §3 si se acepta el hallazgo #16(b), y anotar en `04` §2
  que `renewsAt` es provisional hasta el primer webhook.

### 21. `Invoice` se borra en cascada y W12 pierde histórico — **menor** (abierto)

- **Specs**: `00` §3 (`Invoice.subscription onDelete: Cascade`, `Subscription.business
  onDelete: Cascade`), `05` §4 (`subscriptionCents` = Σ `Invoice PAID` del mes).
- Borrar un negocio (o su suscripción) elimina todas sus facturas, y con ellas el ingreso ya
  reconocido por la plataforma: los reportes financieros de meses cerrados cambiarían
  retroactivamente.
- **Recomendación**: `Invoice` no debería depender del ciclo de vida del negocio. Mínimo:
  `onDelete: Restrict` en `Invoice.subscription`, o denormalizar `businessId` + `planCode` en
  `Invoice` y romper la cascada. Aplica igual a `Payment` (mismo razonamiento contable).

### 22. Precios de planes duplicados entre BD, seed y landing — **menor** (abierto)

- **Specs**: `04` §1, `06` §1 (sección de precios de la landing), `00` §9 (seed).
- Los mismos tres precios y límites viven en la tabla de `04` §1, en el seed y en el
  contenido de la landing (F6-02/F6-06 los tratan como contenido estático). Cambiar un
  precio exigirá tres ediciones y un `sync-stripe-plans`; la landing quedará desfasada sin
  que nada falle.
- **Recomendación**: que la sección de precios de la landing lea `Plan` (una query pública
  cacheada) o, si se prefiere estático, anotar en `06` que los precios se copian de `04` §1 y
  agregar el paso a la checklist de cambio de precio.

### 23. Cuándo se cobra el prorrateo — **menor** (resuelto en F4-04/F4-09)

- **Specs**: `04` §2, §4, §5.
- `create_prorations` **no** cobra en el momento: acumula líneas para la próxima factura. La
  spec habla de "prorrateo" sin decirlo, y el diálogo del diseño podría hacer creer al
  negocio que se le cobra al instante. Tampoco define el signo de `prorationCents` (un
  downgrade produce **crédito**, es decir, negativo).
- **Resolución (F4-04/F4-09)**: signo documentado (+ cargo / − crédito) y copy explícito
  ("se agregarán a tu próxima factura del {fecha}").
- **Recomendación**: añadir esa frase a `spec/04` §2.

### 24. Rotación de `Price` deja suscripciones vivas en el precio viejo — **menor** (resuelto parcialmente)

- **Specs**: `04` §1 (script de sync), §2.
- `F4-01` decide —correctamente— que al cambiar `priceCents` se crea un `Price` nuevo (los
  de Stripe son inmutables) sin borrar el anterior, para no romper suscripciones vivas. Pero
  nadie migra a los suscriptores existentes: seguirán pagando el precio anterior
  indefinidamente, y `customer.subscription.updated` traerá un `price.id` que ya no coincide
  con ningún `Plan.stripePriceId` (F4-05 conserva el `planId` local y solo loguea).
- **Recomendación**: decidir la política de cambio de precio (respetar el precio contratado
  vs. migrar a todos en la próxima renovación) y, si se migra, agregar un script
  `migrate-subscriptions-price.ts` a `04` §7 que Roger ejecute tras el sync. Guardar además
  el histórico de price ids por plan (`Plan.legacyStripePriceIds String[]`) para poder
  mapear eventos viejos.

---

## Correcciones recomendadas a `spec/03-payments.md`

1. **§1** — reescribir el bloque de saldos con las fórmulas netas exactas (#2) y nombrar
   `grossPaid` / `netToBusiness` para que `02` §1 y `05` §1/§4 las citen (#8).
2. **§1–§2** — una frase normativa sobre el modelo de dinero: Transfer al liberar escrow,
   Payout manual al aprobar retiro, cuenta Express con `payouts.schedule.interval: "manual"`
   (#4). Corregir "Payout Stripe" del diagrama y las menciones de `05` §4/§7.
3. **§2** — documentar la política de comisión en reembolso parcial y que reembolsar un pago
   `RELEASED` no está soportado (#7); definir el fallback de comisión sin suscripción (#10),
   preferiblemente como `PlatformSettings.defaultCommissionPct`.
4. **§2/§5** — decidir Checkout Session vs. Payment Links API para los links de cobro (#9).
5. **§4** — agregar `payment.getConnectStatus` a la tabla de procedures (#5).
6. **§5** — la auto-liberación excluye pagos con disputa no resuelta (#6).
7. **§6** — mapa completo de 5 estados en `payment-status-badge.tsx` (ya cubierto en XC-18) y
   quitar "Pagado".
8. Retro-alinear `spec/00` §3 con el schema real de F3-01: `Payment.paymentLinkId`,
   `Payment.businessId` + índices (#1), `Business.chargesEnabled`/`payoutsEnabled` (#11),
   `CRON_SECRET` en la lista de env (ya cubierto en XC-17).

## Correcciones recomendadas a `spec/04-subscriptions.md`

1. **§1** — declarar si los precios incluyen IVA y dejar CFDI explícitamente fuera de alcance
   (#19); definir la política de cambio de precio y la migración de suscriptores (#24).
2. **§2** — resolver el método de pago: agregar `subscription.createPortalSession` (opción
   recomendada) o dejar escrito el modelo `send_invoice` de F4-03 (#13). Declarar el flujo de
   cancelación/reactivación (#16). Declarar que F4 **modifica** `activeBusinessProcedure`
   (#15, ya cubierto en XC-22). Aclarar que el prorrateo se cobra en la próxima factura y el
   signo de `prorationCents` (#23). Unificar con `05` §2 que el plan inicial lo elige el
   admin (`planCode`), eliminando "standard por defecto" (ya cubierto en XC-02). Anotar que
   `renewsAt` es provisional hasta el primer webhook (#20).
3. **§3** — escribir `ctx.business.plan` aplanado y nullable (#12); documentar la asimetría
   `used >= max` (alta) vs. `used > max` (downgrade) y que `checkDowngradeFit` recibe los
   límites ya resueltos.
4. **§4** — mover `exceeds` del error de `changePlan` al resultado de `previewChange` (#14);
   definir `getCurrent` con suscripción ausente (`result: null`), el tamaño de página y el
   orden de `listInvoices`, y que `previewChange` es una query.
5. **§5** — mover `past-due-banner.tsx` al módulo del layout del dashboard (no puede vivir en
   `subscription/_components/` y ser compartido) y definir la acción del botón "Administrar
   plan" (#13/#16). Añadir el estado de solo-lectura de la UI (#18).
6. **§7** — reescribir la verificación manual: la tarjeta `4000…0341` no es aplicable sin
   captura de método de pago (#13); usar factura hosted vencida o test clock.
7. **`spec/00` §3** — mover `Business.stripeCustomerId` a la migración inicial (#3); evaluar
   `cancelAtPeriodEnd`/`canceledAt` en `Subscription` (#20) y romper la cascada de `Invoice`
   (#21).
