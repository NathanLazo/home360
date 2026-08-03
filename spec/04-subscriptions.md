# F4 — Suscripción y planes (Stripe Billing)

Cubre **W7 (`/dashboard/subscription`)** y la aplicación transversal de límites de plan.
Requiere F3 (cliente Stripe, webhooks).

## 1. Modelo comercial (seed F0)

| Plan | Precio/mes | Comisión | Sucursales | Trabajadores | Productos | Extras |
|------|-----------|----------|------------|--------------|-----------|--------|
| `basic` | $499 | 12 % | 1 | 3 | 50 | — |
| `standard` | $999 | 8 % | 5 | 15 | ilimitados | prioridad matching IA |
| `enterprise` | $1,999 | 5 % | ilimitadas | ilimitados | ilimitados | facturación consolidada, soporte dedicado |

Los `Plan` del seed se sincronizan con Stripe (script `scripts/sync-stripe-plans.ts`,
lo ejecuta Roger una vez en test-mode: crea Product+Price por plan y guarda
`stripePriceId`).

## 2. Ciclo de suscripción

- Al **aprobar** un negocio (F5) se crea `Subscription` local en el plan elegido
  (`standard` por defecto) + Stripe Subscription sobre el customer del negocio
  (se crea `stripeCustomerId` en `Business` — agregar columna en la migración de esta fase).
- **Cambio de plan** (upgrade/downgrade): Stripe `subscriptions.update` con
  `proration_behavior: "create_prorations"`; el downgrade valida antes que el uso actual
  quepa en el plan destino (sucursales/trabajadores/productos publicados) →
  `PLAN_LIMIT_REACHED` con detalle de qué excede.
- Webhooks (extienden el route handler de F3):
  - `invoice.paid` → upsert `Invoice` (PAID) + `renewsAt`.
  - `invoice.payment_failed` → `Subscription.status = PAST_DUE`.
  - `customer.subscription.updated/deleted` → sincroniza plan/status local.
- `PAST_DUE`: banner persistente en todo el dashboard; `CANCELED` degrada el negocio a
  solo-lectura (las mutations de `activeBusinessProcedure` validan suscripción activa).

## 3. Límites de plan — `src/server/services/subscription/plan-limits.ts`

Creado en F2, aquí se completa:

```ts
type LimitedResource = "branches" | "workers" | "products";
assertPlanLimit(db, business, resource): Promise<TrpcResponse<null> | null>
// null = dentro del límite; TrpcResponse = fail(PLAN_LIMIT_REACHED, 409, …)
checkDowngradeFit(db, businessId, targetPlan): Promise<{ fits: boolean; exceeds: LimitedResource[] }>
```

`maxX === null` → ilimitado. Se invoca en: crear sucursal, crear trabajador, publicar
producto, y al cambiar de plan.

## 4. Router `subscription` (business)

| Procedure | Proc | Input | Result / Errores |
|-----------|------|-------|------------------|
| `getCurrent` | business | — | plan actual, `renewsAt`, status, uso vs. límites (`{ branches: { used, max }, … }`) |
| `listPlans` | business | — | los 3 planes con precios y features |
| `changePlan` | active | `{ planCode }` | `{ planCode, prorationCents }` · `PLAN_LIMIT_REACHED` (con `exceeds`) · `STRIPE_ERROR` |
| `previewChange` | active | `{ planCode }` | `{ prorationCents, effectiveAt }` (upcoming invoice) |
| `listInvoices` | business | `{ cursor? }` | facturas con `pdfUrl` |

## 5. UI — W7 `/dashboard/subscription`

```text
subscription/  page.tsx · loading.tsx · error.tsx  +  _components/
├─ subscription-view.tsx
├─ current-plan-banner.tsx       # "Plan actual: Estándar · renueva el 15 ago"
├─ plan-cards.tsx                # grid de 3
├─ plan-card.tsx                 # precio, comisión, features; card del plan actual resaltada ("Tu plan")
├─ plan-feature-list.tsx         # checks de features (límite null → "ilimitado")
├─ change-plan-dialog.tsx        # confirma con prorrateo de previewChange; downgrade inválido lista qué excede
├─ past-due-banner.tsx           # compartido vía layout si status PAST_DUE
├─ invoices-section.tsx          # "Última factura: $999 · 15 jul · pagada" + "Descargar facturas"
├─ subscription.schema.ts · subscription.types.ts
└─ use-subscription-mutations.ts
```

Botones por card según relación con el plan actual: "Cambiar a Básico" (outline) /
"Administrar plan" (actual) / "Mejorar plan" (primario) — como el diseño.

## 6. Pruebas

- `plan-limits.test.ts` (amplía F2): downgrade con 3 sucursales a `basic` → no cabe,
  `exceeds: ["branches"]`.
- `change-plan.test.ts` (stripe fake): upgrade llama update con proration; downgrade
  inválido no toca Stripe.
- Webhook `invoice.paid` duplicado → una sola Invoice (upsert por `stripeInvoiceId`).

## 7. Verificación y comandos de Roger

```bash
pnpm tsx scripts/sync-stripe-plans.ts
```

```bash
pnpm prisma migrate dev --name add_stripe_customer_id
```

Manual: con clock de test de Stripe o tarjeta `4000…0341` (falla) provocar `PAST_DUE` y
ver el banner; upgrade standard→enterprise muestra prorrateo antes de confirmar; límite
de sucursales cambia en vivo tras upgrade.

### Criterios de aceptación

- [ ] W7 replica las 3 cards, banner de renovación y sección de facturas.
- [ ] Comisión de nuevos pagos usa el % del plan vigente (pagos previos intactos, F3).
- [ ] Downgrade imposible si el uso excede el plan destino, con mensaje específico.
- [ ] Facturas descargables desde `pdfUrl` de Stripe.
- [ ] `PAST_DUE`/`CANCELED` degradan el dashboard como se especifica.
