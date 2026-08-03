# F7 — Cuentas corporativas B2B

Cubre la segunda fuente de ingresos del deck: **membresías mensuales a empresas que consumen
servicios** (restaurantes, hoteles, cadenas de retail, clínicas, escuelas). Es la decisión D4
de [`08-business-model-alignment.md`](08-business-model-alignment.md).

Requiere **F4** (Stripe Billing, cuyo patrón se reutiliza tal cual) y **F5** (panel admin,
donde se administran las cuentas). No tiene pantalla en el diseño `HOME360 Web.dc.html`: es
producto nuevo derivado del deck, así que su UI sigue el sistema ya establecido (shadcn zinc,
mismo layout de dashboard) en vez de replicar una maqueta.

## 1. Por qué es un dominio aparte

`Business` modela a quien **presta** el servicio: tiene plan, comisión, sucursales
operativas, trabajadores y cuenta Connect para cobrar. Una cuenta corporativa es lo
contrario: **consume** servicios, paga una membresía, tiene sucursales que son *ubicaciones
a atender*, y su ventaja económica es una comisión preferente sobre las órdenes que genera.

Meterlas en la misma tabla obligaría a que la mitad de las columnas fueran nulas y a que cada
query filtrara por tipo. Son entidades distintas que comparten el marketplace.

## 2. Modelo de datos

`F0-12` ya declara `Order.corporateAccountId` como FK real hacia un `CorporateAccount`
mínimo. Esta fase amplía ese mismo modelo y agrega ubicaciones, membresía, facturas y
términos; no crea una segunda relación ni convierte un escalar.

```prisma
enum CorporateTier   { BASIC STANDARD ENTERPRISE CUSTOM }
enum CorporateStatus { PENDING ACTIVE SUSPENDED CANCELLED }

model CorporateAccount {
  id                String            @id @default(cuid())
  name              String
  taxId             String?           // RFC para facturación consolidada
  ownerId           String            @unique
  owner             User              @relation(fields: [ownerId], references: [id])
  tier              CorporateTier     @default(BASIC)
  status            CorporateStatus   @default(PENDING)
  commissionPct     Int               // 10 / 8 / 5 / negociado (< 5 en CUSTOM)
  monthlyFeeCents   Int               // 150000 / 350000 / 750000 / negociado
  maxLocations      Int?              // 3 / 15 / 50 / null = ilimitado
  accountManagerId  String?           // ejecutivo de cuenta (tier ≥ STANDARD)
  stripeCustomerId  String?           @unique
  statusReason      String?
  locations         CorporateLocation[]
  membership        CorporateMembership?
  orders            Order[]
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([status, tier])
}

model CorporateLocation {
  id                 String           @id @default(cuid())
  corporateAccountId String
  corporateAccount   CorporateAccount @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)
  name               String
  addressLine        String
  city               String
  contactName        String?
  contactPhone       String?
  isActive           Boolean          @default(true)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([corporateAccountId, isActive])
}

model CorporateMembership {
  id                   String           @id @default(cuid())
  corporateAccountId   String           @unique
  corporateAccount     CorporateAccount @relation(fields: [corporateAccountId], references: [id])
  stripeSubscriptionId String?          @unique
  status               SubscriptionStatus
  renewsAt             DateTime?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
}
```

`User` gana `corporateAccount CorporateAccount?` y el rol `CORPORATE` en `UserRole`.

**Tabla de tiers** (seed, igual que `Plan`): los valores viven en BD, no en constantes, para
que el admin pueda negociar `CUSTOM` sin desplegar.

| Tier | Precio/mes | Ubicaciones | Comisión | Extras |
|------|-----------|-------------|----------|--------|
| `BASIC` | $1,500 | hasta 3 | 10 % | dashboard centralizado, facturación unificada |
| `STANDARD` | $3,500 | 4–15 | 8 % | ejecutivo de cuenta, servicios recurrentes |
| `ENTERPRISE` | $7,500 | 16–50 | 5 % | SLA 2 h urgente, proveedores preferentes |
| `CUSTOM` | negociado | +50 | < 5 % | integración ERP/SAP, contrato a la medida |

## 3. Efecto sobre el dinero

Es la razón de ser del tier, y ya está previsto en `F3-03`: `resolveCommissionPct` tiene la
rama corporativa como punto de extensión. Esta fase la **activa**:

```text
commissionPct = corporateAccount?.commissionPct ?? providerPlan.commissionPct
```

Consecuencias que no se pueden pasar por alto:

- La comisión se sigue **congelando** en el `Payment` al cobrar. Renegociar el tier no toca
  pagos históricos.
- El **bono de lealtad** (D3) se calcula sobre esa comisión ya reducida: en órdenes
  corporativas el proveedor recibe un bono menor porque la comisión fue menor. Es coherente
  con el programa, pero conviene que el admin lo entienda al negociar un `CUSTOM` agresivo:
  bajar la comisión al 3 % reduce el ingreso neto de plataforma **y** el incentivo del
  proveedor a la vez.
- Una cuenta `SUSPENDED` o `CANCELLED` no aporta comisión preferente: sus órdenes nuevas caen
  al plan del proveedor.

## 4. Procedure nueva en la jerarquía

Se suma un escalón al árbol existente, con la misma disciplina: rol verificado en servidor y
`ctx` enriquecido con narrowing real, sin casts.

```text
publicProcedure
└─ protectedProcedure
   ├─ userProcedure            # CUSTOMER
   ├─ businessProcedure        # BUSINESS → ctx.business
   │  └─ activeBusinessProcedure
   ├─ corporateProcedure       # CORPORATE → ctx.corporateAccount (nueva)
   │  └─ activeCorporateProcedure   # además status === ACTIVE
   └─ adminProcedure           # ADMIN
```

`corporateProcedure` resuelve la cuenta **desde la sesión**, nunca desde input, y todo query
filtra por `ctx.corporateAccount.id` dentro de la consulta Prisma.

## 5. Routers

### `corporate` (dashboard del cliente corporativo)

| Procedure | Proc | Input | Result / Errores |
|-----------|------|-------|------------------|
| `getOverview` | corporate | `{ month? }` | gasto del mes, órdenes activas, ubicaciones, ahorro por comisión preferente |
| `listOrders` | corporate | `{ locationId?, status?, cursor? }` | órdenes de **todas** sus ubicaciones |
| `listLocations` / `createLocation` / `updateLocation` / `deactivateLocation` | active | schemas propios | `PLAN_LIMIT_REACHED` si excede `maxLocations` |
| `getMembership` | corporate | — | tier, precio, renovación, uso vs. límite |
| `listInvoices` | corporate | `{ cursor? }` | facturas consolidadas con `pdfUrl` |
| `requestTierChange` | active | `{ tier }` | `{ id }` — no cambia solo: abre solicitud al admin (los tiers se negocian) |

### `admin.corporate` (namespace admin, `adminProcedure`)

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` | `{ status?, tier?, search?, cursor? }` | cuentas con ubicaciones, gasto y estado |
| `getById` | `{ accountId }` | expediente completo |
| `create` | `{ name, taxId?, ownerEmail, tier, commissionPct?, monthlyFeeCents?, maxLocations? }` | crea usuario CORPORATE + cuenta PENDING |
| `activate` | `{ accountId }` | transacción: `ACTIVE` + customer y suscripción Stripe (patrón F4) |
| `updateTerms` | `{ accountId, tier, commissionPct, monthlyFeeCents, maxLocations }` | términos negociados; **solo afecta órdenes futuras** |
| `suspend` / `reactivate` | `{ accountId, reason? }` | `{ id }` |

`create` no fija contraseña: emite invitación por correo, igual que el alta de trabajadores.
El agente **nunca** genera credenciales.

## 6. UI

### `/corporate` — dashboard del cliente corporativo

Layout propio (`corporate/layout.tsx`) con `AppSidebar variant="light"`, reutilizando los
componentes compartidos de F0. Módulos, todos con el patrón `_components/` estándar:

```text
corporate/
├─ page.tsx                     # resumen: KPIs de gasto, órdenes activas, ahorro por comisión
├─ orders/                      # tabla consolidada con filtro por ubicación
├─ locations/                   # CRUD con límite por tier
└─ membership/                  # tier actual, uso, facturas, solicitud de cambio
```

### `/admin/corporate` — administración

Tabla con tabs por estado, `Sheet` de detalle, `Dialog` de alta y `AlertDialog` para
suspensión con razón obligatoria. Los términos negociados se editan en un formulario propio
con nota persistente de que no reescriben pagos históricos.

Copy en `src/messages/{es,en}/corporate.json` y las claves de admin en `admin.json`.

## 7. Verificación

1. `pnpm typecheck` · `pnpm check` · `pnpm build`.
2. Manual con seed: crear cuenta `STANDARD` con 5 ubicaciones → activar → aparece
   suscripción en Stripe test-mode; generar una orden desde una ubicación → el `Payment`
   congela **8 %** y no el porcentaje del plan del proveedor; intentar la ubicación 16 →
   `PLAN_LIMIT_REACHED`; suspender la cuenta → una orden nueva vuelve a la comisión del plan
   del proveedor.
3. Ningún router `corporate.*` accesible con rol BUSINESS, CUSTOMER o ADMIN, y ningún
   `admin.corporate.*` accesible con rol CORPORATE (403 uniforme).

### Criterios de aceptación

- [ ] La comisión de órdenes corporativas sale de la cuenta y queda congelada en el pago.
- [ ] El bono de lealtad se calcula sobre la comisión efectiva, también en órdenes corporativas.
- [ ] Límite de ubicaciones aplicado en servidor, con el mismo contrato de error que los
      límites de plan de F4.
- [ ] `updateTerms` no altera ningún `Payment` existente.
- [ ] Facturación consolidada descargable desde Stripe.

## 8. Comandos que ejecuta Roger

```bash
pnpm prisma migrate dev --name add_corporate_accounts
```

```bash
pnpm tsx scripts/sync-stripe-corporate-tiers.ts
```
