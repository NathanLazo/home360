# [F0-12] Extensiones de marketplace en el schema (cotizaciones, bonos, evidencia)

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/08-business-model-alignment.md` D3, D4, D5 · `spec/07-product-context.md` §3
- **Depende de**: `F0-03` (mismo archivo; se aplica encima)
- **Tamaño estimado**: L (3–6 h)

## Contexto

El diseño de la app móvil reveló que el modelo de F0-03 no cubre piezas que son raíz del
producto: el cliente publica una solicitud y **varios negocios cotizan** (C4/N2), el
trabajador cierra el servicio con **grabación y evidencia** (T2/T3), y el negocio acumula
**bonos de lealtad** en su wallet (N4). Su lógica/UI pertenece a fases posteriores o a la
app móvil, pero todas tocan tablas raíz: agregarlas después obliga a migrar datos existentes.
Este ticket las declara en la migración inicial y ahí se detiene — **no escribe lógica ni UI**.

**Decisiones de diseño de datos tomadas aquí** (documentar en comentarios del schema):

1. **La solicitud es una entidad aparte, no un `Order` en estado inicial.** Se crea
   `ServiceRequest`, los negocios responden con `Quote`, y aceptar una cotización **crea** el
   `Order`. Motivo: `Order` ya significa "trabajo con negocio y precio definidos" en los 94
   tickets escritos (F2 lo lista, F3 le cobra, F5 lo disputa); convertirlo en un contenedor
   sin negocio rompería todos esos supuestos. Con esta forma, F2–F5 siguen válidos sin tocar
   una línea.
2. **Los materiales usados son tabla, no JSON.** `OrderMaterial` permite `select` tipado y
   FK opcional a `Product`; un campo JSON obligaría a tipos vagos, prohibidos por la
   convención de TypeScript estricto del proyecto.
3. **La FK corporativa necesita un ancla relacional real.** D4/D5 exigen que
   `Order.corporateAccountId` entre como llave foránea en la migración inicial. Prisma no
   puede crear una FK hacia un modelo inexistente, por lo que se declara en F0 un
   `CorporateAccount` mínimo (`id`, lado inverso y timestamps). F7 amplía ese modelo con el
   dominio B2B; F0 no implementa membresías, ubicaciones, servicios ni UI corporativa.

## Alcance

Modificar:

- `prisma/schema.prisma` — único archivo del ticket, encima de lo que dejó `F0-03`.

Después ejecutar **solo** `pnpm prisma generate`.

Fuera de alcance: servicios, procedures o UI que consuman estos modelos (no existen en
F1–F6); el dominio corporativo de F7; mensajería por orden y el marketplace de materiales,
que quedan explícitamente fuera por D5.

## Detalle técnico

### Enums nuevos

```prisma
enum QuoteStatus       { PENDING ACCEPTED REJECTED EXPIRED }
enum RequestStatus     { OPEN QUOTED ACCEPTED CANCELLED EXPIRED }
enum WorkerAvailability{ AVAILABLE ON_SERVICE OFF }
enum InvitationStatus  { PENDING ACCEPTED }
enum LoyaltyBonusStatus{ PENDING PAID CANCELLED }
enum LoyaltyPayoutMethod { VOUCHER TRANSFER }
enum DocumentType      { ID_DOCUMENT ADDRESS_PROOF INSURANCE_POLICY DEPOSIT_RECEIPT ASSET_TITLE OTHER }
enum DocumentStatus    { PENDING APPROVED REJECTED }
```

### `ServiceRequest` y `Quote`

`ServiceRequest` guarda lo que produce el diagnóstico IA (C3) y es de dónde cuelgan las
cotizaciones:

```prisma
model ServiceRequest {
  id                String        @id @default(cuid())
  customerId        String
  customer          User          @relation(fields: [customerId], references: [id])
  title             String
  description       String?
  category          String
  photoUrls         String[]
  aiConfidencePct   Int?          // 0–100, confianza del diagnóstico
  aiDiagnosis       String?
  aiMinPriceCents   Int?          // rango de precio justo estimado
  aiMaxPriceCents   Int?
  addressLine       String?
  latitude          Float?
  longitude         Float?
  status            RequestStatus @default(OPEN)
  expiresAt         DateTime?
  quotes            Quote[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([customerId])
  @@index([status, createdAt])
  @@index([category])
}

model Quote {
  id             String         @id @default(cuid())
  requestId      String
  request        ServiceRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  businessId     String
  business       Business       @relation(fields: [businessId], references: [id])
  branchId       String?
  branch         Branch?        @relation(fields: [branchId], references: [id], onDelete: SetNull)
  workerId       String?
  worker         Worker?        @relation(fields: [workerId], references: [id], onDelete: SetNull)
  amountCents    Int            // precio ofertado por el negocio (sin tarifa de servicio)
  message        String?
  scheduledFor   DateTime?
  status         QuoteStatus    @default(PENDING)
  order          Order?         // se puebla al aceptar
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@unique([requestId, businessId])   // un negocio cotiza una vez por solicitud
  @@index([businessId, status])
  @@index([requestId])
  @@index([branchId])
  @@index([workerId])
}
```

`Order` gana el vínculo inverso `quoteId String? @unique` + `quote Quote? @relation(...)`.
Invariante de dominio (servicios, no BD): a lo sumo una `Quote` por solicitud queda
`ACCEPTED`, y es la que produjo el `Order`.

### Evidencia y cierre de servicio — `Order` y `OrderMaterial`

```prisma
  // dentro de model Order
  // recordingUrl String? ya existe desde F0-03 y se conserva sin duplicarlo
  recordingDurationSec  Int?
  recordingComplete     Boolean  @default(false)  // false ⇒ D6: disputa a favor del cliente
  beforeUrls            String[]
  afterUrls             String[]
  workNotes             String?
  corporateAccountId    String?
  corporateAccount      CorporateAccount? @relation(fields: [corporateAccountId], references: [id], onDelete: SetNull)
  materials             OrderMaterial[]

  @@index([corporateAccountId])
```

```prisma
model OrderMaterial {
  id             String   @id @default(cuid())
  orderId        String
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId      String?
  product        Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  name           String
  quantity       Int      @default(1)
  unitPriceCents Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([orderId])
  @@index([productId])
}
```

Ancla mínima para que `corporateAccountId` sea una FK real desde la migración inicial:

```prisma
model CorporateAccount {
  id        String   @id @default(cuid())
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

F7 modifica este mismo modelo para agregar nombre, membresía, sucursales y demás relaciones.
No debe crear un segundo modelo ni una FK nueva para `Order`.

`recordingComplete` es el campo que consume la regla D6 en la resolución de disputas (F5).

### `LoyaltyBonus` (D3)

```prisma
model LoyaltyBonus {
  id           String              @id @default(cuid())
  businessId   String
  business     Business            @relation(fields: [businessId], references: [id])
  paymentId    String              @unique   // un bono por pago liberado, a lo sumo
  payment      Payment             @relation(fields: [paymentId], references: [id])
  amountCents  Int                 // round(commissionCents * loyaltyBonusPct / 100)
  pctApplied   Int                 // congelado, como la comisión
  status       LoyaltyBonusStatus  @default(PENDING)
  method       LoyaltyPayoutMethod?
  paidAt       DateTime?
  notes        String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@index([businessId, status])
}
```

`Payment` gana el lado inverso `loyaltyBonus LoyaltyBonus?`. El `@unique` en `paymentId` es
lo que vuelve idempotente el devengo al liberar un pago (F3).

### `ProductStock` — inventario por sucursal

Decisión de producto tomada con Roger: el **inventario es por sucursal**, el catálogo no. Un
cartucho en Centro no está disponible en Campestre, y así es como opera cualquier retail con
varias ubicaciones. Los **servicios no** llevan tabla por sucursal: su cobertura ya se deriva
del radio de la sucursal (`Branch`) y de los trabajadores asignados (`Worker.branchId`), así
que una relación explícita sería redundante.

```prisma
model ProductStock {
  id                 String   @id @default(cuid())
  productId          String
  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  branchId           String
  branch             Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  stock              Int      @default(0)
  lowStockThreshold  Int      @default(5)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([productId, branchId])   // una fila por producto y sucursal
  @@index([branchId])
}
```

Notas que evitan errores caros:

- `Product` **no** conserva `stock` ni `lowStockThreshold` (desviación 6 de `F0-03`). Tener
  el dato en dos lugares garantiza que se desincronicen.
- El total de un producto es `SUM(stock)` sobre sus filas, calculado en la query; nunca una
  columna persistida.
- "Stock bajo" sigue siendo **derivado**, ahora por sucursal: `stock <= lowStockThreshold`
  sobre `ProductStock`. Con la vista en "Todas las sucursales", basta con que una fila esté
  baja para marcar el producto.
- El límite `maxProducts` del plan cuenta **productos**, no filas de stock: crear una
  sucursal nueva no consume cupo de catálogo.
- Ausencia de fila ≠ stock 0 con umbral: significa que ese producto no se maneja en esa
  sucursal. La UI las trata igual (0 disponible), pero el dato distingue ambos casos.

`Product` gana `stocks ProductStock[]` y `Branch` gana `productStocks ProductStock[]`.

### `BusinessDocument`

```prisma
model BusinessDocument {
  id          String         @id @default(cuid())
  businessId  String
  business    Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)
  type        DocumentType
  fileUrl     String
  status      DocumentStatus @default(PENDING)
  reviewedById String?
  reviewedBy  User?          @relation(fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt  DateTime?
  notes       String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([businessId, status])
  @@index([reviewedById])
}
```

Cierra la decisión abierta B1 de `F0-findings.md`: W10 sí tiene de dónde leer "documentos".

### `PasswordResetToken` y `AuthAttempt` — soporte de autenticación

Los usan `F1-09` (recuperación de contraseña) y `F1-11` (rate limiting). Entran aquí, y no en
F1, para que no haya una segunda migración por dos tablas pequeñas.

```prisma
model PasswordResetToken {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String   @unique   // SHA-256 del token; el token plano solo viaja por correo
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
  @@index([expiresAt])
}

model AuthAttempt {
  id         String   @id @default(cuid())
  identifier String   // email normalizado o IP, según la regla que lo registre
  action     String   // "login" | "register" | "password-reset"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier, action, createdAt])
}
```

Decisiones que van con estas tablas:

- **Solo se guarda el hash del token**, nunca el token plano: si la base se filtra, los
  enlaces de recuperación siguen siendo inservibles. Es el mismo criterio que con las
  contraseñas.
- `AuthAttempt` es una tabla de intentos con ventana deslizante en Postgres, sin Redis. El
  stack no tiene Redis y un contador en memoria no sirve en serverless (cada instancia
  contaría por su cuenta). El costo es escritura por intento y una limpieza periódica; si
  algún día el volumen lo justifica, la ruta de salida es Upstash sin cambiar la interfaz del
  servicio.
- `User` gana `passwordResetTokens PasswordResetToken[]` y
  `sessionsValidFrom DateTime @default(now())`. Este último es lo que permite **invalidar
  sesiones JWT existentes** al cambiar la contraseña: el callback `jwt` compara el `iat` del
  token contra esta fecha y rechaza los anteriores. Sin él, cambiar la contraseña dejaría
  viva la sesión robada, que es justo de lo que el usuario está huyendo.

### Campos nuevos de `Worker`

```prisma
  branchId         String?
  branch           Branch?            @relation(fields: [branchId], references: [id], onDelete: SetNull)
  specialty        String?            // "Plomero", "Electricista", "Repartidor"
  availability     WorkerAvailability @default(AVAILABLE)
  ratingAvg        Float?
  invitedEmail     String?
  invitationStatus InvitationStatus   @default(ACCEPTED)
  quotes           Quote[]

  @@index([branchId])
  @@index([businessId, availability])
```

Esto cierra el hallazgo `XC-07` (la tabla de equipo mostraba sucursal sin relación que la
soporte) y da base al alta por invitación que muestra N6.

### Lados inversos a no olvidar

`Business`: `quotes Quote[]`, `documents BusinessDocument[]`, `loyaltyBonuses LoyaltyBonus[]`.
`Branch`: `quotes Quote[]`, `workers Worker[]`.
`User`: `serviceRequests ServiceRequest[]`, `reviewedDocuments BusinessDocument[]`.
`Product`: `orderMaterials OrderMaterial[]`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm prisma generate` sin errores ni warnings de relaciones.
- [ ] Ambos lados declarados en cada relación nueva; todo FK con `@@index`.
- [ ] `Order.corporateAccountId` tiene relación Prisma y constraint FK real hacia el
      `CorporateAccount` mínimo; F7 queda indicado como ampliación del mismo modelo.
- [ ] `Quote.@@unique([requestId, businessId])` y `LoyaltyBonus.paymentId @unique` presentes
      (son las invariantes que vuelven idempotentes cotizar y devengar).
- [ ] `ProductStock.@@unique([productId, branchId])` presente, y `Product` **no** tiene
      `stock` ni `lowStockThreshold`.
- [ ] Todo campo de dinero es `Int` en centavos; todos los modelos nuevos con
      `createdAt`/`updatedAt`.
- [ ] Las tres decisiones de diseño del Contexto quedan como comentarios en el schema,
      incluida la razón del ancla corporativa mínima.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Una sola migración inicial para `F0-03` + `F0-12`:

```bash
pnpm prisma migrate dev --name init_home360_domain
```
