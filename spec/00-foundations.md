# F0 — Fundaciones

Deja el repo listo para construir cualquier módulo: schema Prisma completo del dominio,
contrato tRPC, procedures por rol, sistema de diseño (shadcn/ui + Geist + zinc), i18n
(next-intl es/en), layouts base y seed. **No incluye pantallas funcionales** (eso empieza en F1).

## 1. Limpieza del scaffold

- `prisma/schema.prisma`: eliminar la relación rota `posts Post[]` en `User`.
- Eliminar `src/app/_components/post.tsx`; `src/app/page.tsx` se moverá bajo `[locale]` en
  esta fase (placeholder de landing hasta F6).
- `src/server/auth/config.ts`: quitar el import sin uso de `DiscordProvider`.

## 2. Dependencias nuevas

```bash
pnpm add stripe bcryptjs next-intl recharts
pnpm add -D @types/bcryptjs vitest
```

shadcn/ui se inicializa con su CLI (`pnpm dlx shadcn@latest init`, estilo *new-york*, base
zinc) y se instalan los componentes base: `button card input label select dropdown-menu
dialog alert-dialog sheet table badge tabs skeleton sonner separator avatar switch
textarea command chart`.

## 3. Schema Prisma completo

Reglas: dinero en **centavos MXN (`Int`)**, todos los modelos persistentes con
`createdAt/updatedAt`, `@@index` en FKs y campos de filtro, ambos lados de cada relación.
IDs `String @id @default(cuid())`.

```prisma
enum UserRole { ADMIN BUSINESS CUSTOMER WORKER }
enum BusinessType { SERVICES PRODUCTS MIXED }
enum BusinessStatus { PENDING ACTIVE SUSPENDED }
enum GuaranteeType { DEPOSIT VERIFICATION INSURANCE_PER_SERVICE REGISTERED_ASSET COMBINED }
enum BranchStatus { ACTIVE PAUSED }
enum ServiceStatus { ACTIVE PAUSED }
enum ProductStatus { DRAFT PUBLISHED }
enum OrderType { SERVICE PRODUCT }
enum OrderStatus { PENDING PAID IN_PROGRESS SHIPPING COMPLETED CANCELLED DISPUTED }
enum PaymentMethod { CARD TRANSFER PAYMENT_LINK }
enum PaymentStatus { PENDING IN_ESCROW RELEASED REFUNDED PARTIALLY_REFUNDED }
enum WithdrawalStatus { REQUESTED APPROVED REJECTED }
enum SubscriptionStatus { ACTIVE PAST_DUE CANCELED }
enum InvoiceStatus { PAID OPEN VOID }
enum DisputeStatus { OPEN IN_REVIEW RESOLVED }
enum DisputeUrgency { NORMAL URGENT }
enum DisputeResolution { PARTIAL_REFUND FULL_REFUND RELEASE_PAYMENT MORE_EVIDENCE }
```

### Cuentas y negocio

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(CUSTOMER)
  passwordHash  String?                    // null si solo usa OAuth
  accounts      Account[]
  sessions      Session[]
  business      Business?                  // dueño del negocio (role BUSINESS)
  workerProfile Worker?
  orders        Order[]                    // como cliente
  reviews       Review[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Business {
  id              String          @id @default(cuid())
  name            String
  type            BusinessType
  status          BusinessStatus  @default(PENDING)
  guaranteeType   GuaranteeType
  guaranteeNotes  String?
  ownerId         String          @unique
  owner           User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  stripeAccountId String?         @unique   // cuenta Connect (F3)
  branches        Branch[]
  workers         Worker[]
  services        Service[]
  products        Product[]
  orders          Order[]
  paymentLinks    PaymentLink[]
  withdrawals     Withdrawal[]
  subscription    Subscription?
  disputes        Dispute[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([status])
}

model Branch {
  id               String       @id @default(cuid())
  name             String
  address          String
  managerName      String?
  coverageRadiusKm Int          @default(10)
  status           BranchStatus @default(ACTIVE)
  businessId       String
  business         Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orders           Order[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([businessId])
}

model Worker {
  id         String    @id @default(cuid())
  userId     String?   @unique              // opcional: cuenta móvil vinculada
  user       User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  fullName   String
  businessId String
  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  services   Service[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([businessId])
}
```

### Catálogo

```prisma
model Service {
  id              String        @id @default(cuid())
  name            String
  category        String        // "Plomería", "Eléctrico", "Pintura", …
  basePriceCents  Int           // referencia para el matching de IA
  durationMinutes Int           // duración mínima estimada
  durationMaxMinutes Int?
  status          ServiceStatus @default(ACTIVE)
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  workers         Worker[]
  orders          Order[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([businessId, status])
  @@index([businessId, category])
}

model Product {
  id                String        @id @default(cuid())
  name              String
  sku               String
  category          String
  priceCents        Int
  stock             Int           @default(0)
  lowStockThreshold Int           @default(5)
  status            ProductStatus @default(DRAFT)
  businessId        String
  business          Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orders            Order[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@unique([businessId, sku])
  @@index([businessId, status])
}
```

### Órdenes y dinero

```prisma
model Order {
  id          String      @id @default(cuid())
  folio       Int         @unique @default(autoincrement())  // "#1042"
  type        OrderType
  title       String      // "Fuga en llave", "Pintura 4L × 2"
  status      OrderStatus @default(PENDING)
  amountCents Int
  customerId  String
  customer    User        @relation(fields: [customerId], references: [id])
  businessId  String
  business    Business    @relation(fields: [businessId], references: [id])
  branchId    String?
  branch      Branch?     @relation(fields: [branchId], references: [id], onDelete: SetNull)
  serviceId   String?
  service     Service?    @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  productId   String?
  product     Product?    @relation(fields: [productId], references: [id], onDelete: SetNull)
  quantity    Int         @default(1)
  recordingUrl String?    // grabación obligatoria del servicio (disputas)
  payment     Payment?
  dispute     Dispute?
  review      Review?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([businessId, status])
  @@index([businessId, branchId])
  @@index([customerId])
}

model Payment {
  id                    String        @id @default(cuid())
  orderId               String        @unique
  order                 Order         @relation(fields: [orderId], references: [id])
  method                PaymentMethod
  status                PaymentStatus @default(PENDING)
  amountCents           Int
  commissionPctApplied  Int           // congelado al cobrar (bps no: entero %)
  commissionCents       Int           // amount * pct, congelado
  refundedCents         Int           @default(0)
  stripePaymentIntentId String?       @unique
  stripeTransferId      String?       @unique
  escrowReleaseAt       DateTime?     // fecha de auto-liberación
  releasedAt            DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([status])
}

model PaymentLink {
  id             String    @id @default(cuid())
  businessId     String
  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  concept        String
  amountCents    Int
  stripeUrl      String
  stripeSessionId String?  @unique
  paidAt         DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([businessId])
}

model Withdrawal {
  id               String           @id @default(cuid())
  businessId       String
  business         Business         @relation(fields: [businessId], references: [id])
  amountCents      Int
  bankName         String           // "BBVA"
  accountLast4     String           // "2210" — jamás la cuenta completa
  status           WithdrawalStatus @default(REQUESTED)
  rejectionReason  String?
  stripeTransferId String?          @unique
  resolvedAt       DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([status])
  @@index([businessId])
}
```

### Suscripción

```prisma
model Plan {
  id             String         @id @default(cuid())
  code           String         @unique   // "basic" | "standard" | "enterprise"
  name           String         // se traduce en UI por code
  priceCents     Int            // 49900 | 99900 | 199900
  commissionPct  Int            // 12 | 8 | 5
  maxBranches    Int?           // null = ilimitado
  maxWorkers     Int?
  maxProducts    Int?
  stripePriceId  String?        @unique
  subscriptions  Subscription[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model Subscription {
  id                   String             @id @default(cuid())
  businessId           String             @unique
  business             Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  planId               String
  plan                 Plan               @relation(fields: [planId], references: [id])
  status               SubscriptionStatus @default(ACTIVE)
  renewsAt             DateTime
  stripeSubscriptionId String?            @unique
  invoices             Invoice[]
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@index([planId])
}

model Invoice {
  id              String        @id @default(cuid())
  subscriptionId  String
  subscription    Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  amountCents     Int
  status          InvoiceStatus
  stripeInvoiceId String?       @unique
  pdfUrl          String?
  issuedAt        DateTime
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([subscriptionId])
}
```

### Confianza y plataforma

```prisma
model Dispute {
  id               String             @id @default(cuid())
  orderId          String             @unique
  order            Order              @relation(fields: [orderId], references: [id])
  businessId       String
  business         Business           @relation(fields: [businessId], references: [id])
  title            String             // "Trabajo incompleto"
  urgency          DisputeUrgency     @default(NORMAL)
  status           DisputeStatus      @default(OPEN)
  customerArgument String
  businessArgument String?
  evidenceUrls     String[]           // fotos
  aiSummary        String?            // resumen IA de la grabación
  resolution       DisputeResolution?
  resolutionAmountCents Int?          // monto reembolsado si aplica
  resolvedAt       DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@index([status, urgency])
  @@index([businessId])
}

model Review {
  id         String   @id @default(cuid())
  orderId    String   @unique
  order      Order    @relation(fields: [orderId], references: [id])
  customerId String
  customer   User     @relation(fields: [customerId], references: [id])
  rating     Int      // 1–5
  comment    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model PlatformSettings {
  id                        Int      @id @default(1)      // singleton
  aiConfidenceThresholdPct  Int      @default(85)
  aiPriceMarginPct          Int      @default(25)
  aiPricingModel            String   @default("v3.2")
  aiHumanReviewBelowThreshold Boolean @default(true)
  customerServiceFeeCents   Int      @default(2500)
  loyaltyBonusCents         Int      @default(15000)
  loyaltyBonusEveryOrders   Int      @default(50)
  escrowAutoReleaseHours    Int      @default(72)
  notifyNewRequestRadiusKm  Int      @default(10)
  notifyPaymentRelease      Boolean  @default(true)
  notifyRatingReminderHours Int      @default(24)
  updatedAt                 DateTime @updatedAt
}
```

Los modelos NextAuth (`Account`, `Session`, `VerificationToken`) se conservan tal cual.

## 4. Contrato tRPC — `src/server/api/contract.ts`

```ts
export type TrpcResponse<TResult, TError = ErrorCode> = {
  result: TResult | null;
  error: TError | null;
  status: number;
  message: string;
};

export const ERROR_CODES = [
  "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "CONFLICT",
  "PLAN_LIMIT_REACHED", "BUSINESS_NOT_ACTIVE", "INSUFFICIENT_BALANCE",
  "STRIPE_ERROR", "INTERNAL_ERROR", "UNKNOWN_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ok = <T>(result: T, message: string, status = 200):
  TrpcResponse<T> => ({ result, error: null, status, message });

export const fail = <T = never>(error: ErrorCode, status: number, message: string):
  TrpcResponse<T> => ({ result: null, error, status, message });
```

- Los códigos de dominio específicos de un módulo (`USER_NOT_FOUND`, `SKU_TAKEN`…) se
  declaran en el `*.schema.ts` del módulo como subtipo de `string` y se pasan por el
  genérico `TError`; `errors.json` de i18n los cubre todos.
- `message` es texto de referencia del servidor (inglés, corto); la UI **siempre** traduce
  a partir de `error`.
- En `catch` se captura `unknown`, se normalizan errores conocidos de Prisma
  (`P2002 → CONFLICT`, `P2025 → NOT_FOUND`) y Stripe (`StripeError → STRIPE_ERROR`) en un
  helper `normalizeError(error: unknown): { code: ErrorCode; status: number }` del mismo
  archivo. Jamás se exponen stack traces ni SQL.

## 5. Procedures por rol — `src/server/api/trpc.ts`

Extender el archivo existente (conservar `createTRPCContext`, `superjson`, `timingMiddleware`):

```ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } } });
});

export const userProcedure = protectedProcedure.use(/* role CUSTOMER → ctx tipado */);
export const businessProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // 1. role !== BUSINESS → TRPCError FORBIDDEN
  // 2. carga Business por ownerId = session.user.id con select mínimo:
  //    { id, status, subscription: { plan: { commissionPct, maxBranches, maxWorkers, maxProducts } } }
  // 3. sin negocio → FORBIDDEN
  // 4. next({ ctx: { ...ctx, business } })  → ctx.business no-nulo por narrowing
});
export const activeBusinessProcedure = businessProcedure.use(({ ctx, next }) => {
  // business.status !== ACTIVE → TRPCError FORBIDDEN (la UI muestra estado PENDING/SUSPENDED)
});
export const adminProcedure = protectedProcedure.use(/* role ADMIN */);
```

Notas:

- El rol viaja en la sesión JWT (ver F1); `businessProcedure` hace **una** consulta por
  request para cargar el tenant con su plan (se reutiliza en límites y comisiones).
- Los `TRPCError` de las guardas se convierten al contrato en un `errorFormatter`… **no**:
  para mantener el contrato uniforme, las guardas lanzan `TRPCError` solo para
  UNAUTHORIZED/FORBIDDEN (casos de infraestructura); el cliente los mapea a
  `UNAUTHORIZED`/`FORBIDDEN` en un helper compartido de la capa de UI. Todo lo demás
  retorna `TrpcResponse` normal.

## 6. i18n — next-intl

- `src/i18n/routing.ts`: `locales: ["es", "en"]`, `defaultLocale: "es"`,
  `localePrefix: "as-needed"` (`/dashboard` = español, `/en/dashboard` = inglés).
- `src/i18n/request.ts`: carga por namespace.
- Mensajes en `src/messages/{es,en}/`: `common.json`, `landing.json`, `auth.json`,
  `dashboard.json`, `admin.json`, `errors.json`. `errors.json` tiene una clave por cada
  código de error del contrato.
- Páginas bajo `src/app/[locale]/`; APIs (`api/auth`, `api/trpc`, `api/webhooks`) fuera
  del segmento.
- `LocaleSwitcher` (DropdownMenu, `src/components/locale-switcher.tsx`).
- Formatos: moneda `MXN` (`cents / 100`), fechas relativas y números vía
  `useFormatter`/`getFormatter`.

## 7. Sistema de diseño

- `layout.tsx` raíz: fuentes **Geist** y **Geist Mono** vía `next/font/google`, `<Toaster>`
  de sonner, `NextIntlClientProvider`, `TRPCReactProvider` (existente).
- `globals.css`: tokens shadcn base zinc alineados al diseño (`background #f4f4f5`,
  `foreground #09090b`, muted `#71717a`); radio 8 px; Geist Mono para folios/SKU/montos.
- Componentes compartidos en `src/components/` (solo los de reuso real entre módulos):
  - `app-sidebar.tsx` — sidebar con variante `light` (dashboard) y `dark` (admin);
    recibe items, badge de conteo y usuario. Piezas: `sidebar-nav-item.tsx`,
    `sidebar-user-card.tsx`.
  - `kpi-card.tsx` — label, valor, delta/subtexto.
  - `data-table.tsx` — tabla shadcn tipada por genérico con columnas declarativas.
  - `status-badge.tsx` — mapa estado→variante de color, tipado por unión.
  - `search-filter-bar.tsx` — input de búsqueda + selects de filtro.
  - `page-header.tsx` — título, subtítulo, acciones a la derecha.
  - `empty-state.tsx`, `confirm-dialog.tsx` (wrapper de AlertDialog).
- Layouts de módulo: `[locale]/dashboard/layout.tsx` (sidebar claro + header con selector
  de sucursal y LocaleSwitcher) y `[locale]/admin/layout.tsx` (sidebar oscuro `#18181b`).
  En F0 los layouts renderizan con datos estáticos; F1/F2 los conectan.

## 8. Env y Stripe scaffolding

- `src/env.js`: agregar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (server) y
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client).
- `src/server/services/stripe/client.ts`: singleton del SDK `stripe` con `apiVersion`
  fijada; **todo servicio que use Stripe lo recibe por parámetro** (inyección para tests).
- `.env.example` actualizado con todas las variables comentadas.

## 9. Seed — `prisma/seed.ts`

Idempotente (`upsert` por claves naturales). Crea:

- 3 planes: `basic` $499/12 %/1 sucursal/3 trabajadores/50 productos ·
  `standard` $999/8 %/5/15/ilimitado · `enterprise` $1,999/5 %/ilimitado.
- `PlatformSettings` singleton con defaults del diseño (85 %, ±25 %, v3.2, $25, $150/50, 72 h, 10 km, 24 h).
- Usuario admin (`admin@home360.mx`), negocio demo "Plomería García" (plan standard,
  ACTIVE, garantía COMBINED) con 3 sucursales (Centro/Roma Norte/Del Valle), 2 trabajadores,
  4 servicios, ~10 productos (uno con stock bajo, uno borrador), ~15 órdenes en estados
  variados con pagos (escrow/pagado/liberado/reembolsado), 2 disputas (una URGENT con
  `aiSummary`), reseñas para rating ≈ 4.9, negocio PENDING ("Eléctrica Volta") y
  suspendido ("Clima Norte MX"), y 2 retiros REQUESTED.
- Script en `package.json`: `"db:seed": "tsx prisma/seed.ts"` (+ `tsx` como devDependency)
  y bloque `"prisma": { "seed": … }`.

## 10. Verificación y comandos de Roger

Agente:

```bash
pnpm prisma generate
```

```bash
pnpm typecheck
```

```bash
pnpm check
```

Roger (tras revisar la migración generada como archivos):

```bash
pnpm prisma migrate dev --name init_home360_domain
```

```bash
pnpm db:seed
```

### Criterios de aceptación

- [ ] Schema completo compila (`prisma generate` sin errores) y no queda rastro de `Post`.
- [ ] `contract.ts` exporta `TrpcResponse`, `ok`, `fail`, `normalizeError`, `ERROR_CODES`.
- [ ] Las 5 procedures existen y el `ctx` queda tipado por narrowing (sin casts).
- [ ] `/` y `/en` responden con el layout base; `LocaleSwitcher` alterna es/en.
- [ ] Sidebar claro y oscuro renderizan con tipografía Geist y tokens zinc.
- [ ] `pnpm typecheck` y `pnpm check` en verde; cero `any`.
