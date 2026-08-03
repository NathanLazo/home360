# [F7-01] Schema de cuentas corporativas y seed de tiers

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §2 · `spec/08-business-model-alignment.md` D4
- **Depende de**: F5 completada (panel admin) y F4 (Billing); `F0-12` (columna `Order.corporateAccountId`)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Primera pieza de la fase: los modelos del dominio corporativo y los datos de tier. La columna
`Order.corporateAccountId` y su relación a un `CorporateAccount` mínimo ya existen desde la
migración inicial (`F0-12`). Aquí se **amplía ese mismo modelo**; no se convierte un escalar,
no se crea una segunda relación y no hay que migrar datos históricos de `Order`.

## Alcance

Modificar:

- `prisma/schema.prisma` — modelos y enums de `spec/09` §2, más `UserRole.CORPORATE`.
- `prisma/seed/corporate.ts` (o el módulo equivalente del seed existente) — catálogo
  idempotente de tiers y una cuenta demo; conectar el módulo desde el orquestador de seed
  existente sin reestructurarlo.

Después ejecutar **solo** `pnpm prisma generate`.

Fuera de alcance: procedures, servicios y UI (F7-02 en adelante); la activación de la rama
corporativa de comisión (F7-03).

## Detalle técnico

Implementar `CorporateTier`, `CorporateStatus`, `CorporateAccount`, `CorporateLocation` y
`CorporateMembership` de `spec/09` §2, corrigiendo los huecos relacionales de la spec. Añadir
también `CorporateTierConfig`, `CorporateTierChangeRequest` y `CorporateInvoice`: la spec
ordena que los tiers vivan en BD, que `requestTierChange` deje registro y que las facturas de
la membresía se sincronicen desde Stripe, pero no proporcionaba entidades para ninguno de
esos tres contratos.

### Enums adicionales

```prisma
enum CorporateTierChangeStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Catálogo de tiers

```prisma
model CorporateTierConfig {
  id               String        @id @default(cuid())
  tier             CorporateTier @unique
  monthlyFeeCents  Int?
  maxLocations     Int?
  commissionPct    Int?
  stripePriceId    String?       @unique
  isActive         Boolean       @default(true)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([isActive])
}
```

`CUSTOM` también tiene fila, con `monthlyFeeCents`, `commissionPct`, `maxLocations` y
`stripePriceId` en `null`: D4 exige negociación y no autoriza inventar defaults. Los términos
efectivos se capturan explícitamente en la cuenta.

### Relaciones e invariantes

Puntos que no se pueden omitir:

- `Order.corporateAccountId` conserva la `@relation` y el índice de `F0-12`; este ticket solo
  amplía el modelo destino.
- `Order` gana `corporateLocationId String?` y
  `corporateLocation CorporateLocation? @relation(...)`, con
  `@@index([corporateLocationId])`. Sin esta FK, el filtro por ubicación de `spec/09` §5 es
  imposible y una orden podría atribuirse a una ubicación ajena. El servicio que crea la
  orden debe validar que la ubicación pertenece a `corporateAccountId`; la BD no puede
  expresar esa igualdad entre dos FKs opcionales.
- `CorporateLocation` gana `orders Order[]`.
- `User` gana `corporateAccount CorporateAccount?` y el enum `UserRole` gana `CORPORATE`.
- `User` gana `managedCorporateAccounts CorporateAccount[]` para el lado inverso del
  ejecutivo. `CorporateAccount.accountManagerId` se convierte en relación opcional
  `accountManager User? @relation(...)`, con `onDelete: SetNull` e
  `@@index([accountManagerId])`.
- Como `User` se relaciona más de una vez con el dominio, usar nombres explícitos y
  simétricos en ambos lados (`CorporateOwner`, `CorporateAccountManager` y
  `CorporateTierReviewer`); no dejar que Prisma intente inferir relaciones ambiguas.
- `CorporateAccount.ownerId` es `@unique`: un usuario corporativo administra una sola cuenta.
- `CorporateAccount` gana `tierChangeRequests CorporateTierChangeRequest[]` y
  `invoices CorporateInvoice[]`.
- `commissionPct`, `monthlyFeeCents` y `maxLocations` viven **en la cuenta**, no solo en una
  tabla de tiers: los `CUSTOM` se negocian caso por caso y la cuenta debe poder desviarse del
  catálogo sin que el catálogo mienta.
- Todas las relaciones dependientes (`locations`, `membership`, solicitudes y facturas)
  usan `onDelete: Cascade`; las órdenes conservan historia con `onDelete: SetNull`.

```prisma
model CorporateTierChangeRequest {
  id                   String                    @id @default(cuid())
  corporateAccountId   String
  corporateAccount     CorporateAccount          @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)
  requestedTier        CorporateTier
  notes                String?
  status               CorporateTierChangeStatus @default(PENDING)
  pendingKey           String?                    @unique
  reviewedById         String?
  reviewedBy           User?                     @relation(fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt           DateTime?
  createdAt            DateTime                  @default(now())
  updatedAt            DateTime                  @updatedAt

  @@index([corporateAccountId, status, createdAt])
  @@index([reviewedById])
}

model CorporateInvoice {
  id                    String              @id @default(cuid())
  corporateAccountId    String
  corporateAccount      CorporateAccount    @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)
  corporateMembershipId String
  corporateMembership   CorporateMembership @relation(fields: [corporateMembershipId], references: [id], onDelete: Cascade)
  stripeInvoiceId       String              @unique
  amountCents           Int
  status                InvoiceStatus
  pdfUrl                String?
  issuedAt              DateTime
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@index([corporateAccountId, issuedAt])
  @@index([corporateMembershipId])
}
```

`User` gana además el inverso `reviewedCorporateTierChanges CorporateTierChangeRequest[]`, y
`CorporateMembership` gana `invoices CorporateInvoice[]`.

`CorporateMembership` añade `stripeUpdatedAt DateTime?`, epoch del último evento Stripe
aplicado, para que F7-07 descarte eventos atrasados sin depender del orden de entrega.

`pendingKey` vale `corporateAccountId` mientras el estado es `PENDING` y se pone `null` al
aprobar/rechazar. Así la BD garantiza una sola solicitud pendiente por cuenta incluso con
requests concurrentes.

El snapshot monetario de referencia no se redefine aquí: `XC-26` es la unidad transversal que
añade a `Payment` `providerPlanCommissionPctApplied`, `providerPlanCommissionCents` y
`commissionSource`. F7-03/F7-05 consumen esos nombres exactos. No crear aliases como
`providerCommissionPctReference` o `corporateSavingsCents`, porque producirían dos fuentes de
verdad. La pertenencia sigue por `Order.corporateAccountId`.

Seed de `CorporateTierConfig` (referencia para el alta, no configuración obligatoria):
`BASIC` 150000 ¢ / 3 / 10 % · `STANDARD` 350000 ¢ / 15 / 8 % ·
`ENTERPRISE` 750000 ¢ / 50 / 5 % · `CUSTOM` con cuota, límite y comisión `null`, sin
placeholders que puedan confundirse con términos aprobados.
Más una cuenta demo `STANDARD` en Chihuahua con 4 ubicaciones y su usuario CORPORATE, para
que las pantallas de F7-04 y F7-06 tengan qué mostrar.

Usar `upsert` por `tier`, por email normalizado del owner y por una clave estable de cada
ubicación demo. Nunca borrar ni truncar datos. La cuenta demo debe copiar los términos de
`STANDARD`; no debe quedar activa ni con ids Stripe inventados.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm prisma generate` sin errores; ambos lados de cada relación declarados.
- [ ] `Order.corporateAccountId` es relación y su índice sigue presente.
- [ ] Cada orden corporativa puede apuntar a una ubicación de atención mediante
      `corporateLocationId`, y ambas FKs están indexadas.
- [ ] `accountManagerId` tiene relación inversa e índice; no quedan escalares que pretendan
      ser FKs sin relación.
- [ ] El catálogo de tiers, las solicitudes de cambio y las facturas tienen modelos
      persistentes, timestamps, índices y relaciones en ambos lados.
- [ ] El schema es compatible con el snapshot monetario de `XC-26`, sin campos duplicados.
- [ ] `CorporateMembership.stripeUpdatedAt` permite rechazar eventos Stripe atrasados.
- [ ] Las tres relaciones entre `User` y el dominio corporativo tienen nombres explícitos en
      ambos lados y Prisma no reporta ambigüedad.
- [ ] Todo campo monetario es `Int` en centavos; no hay `Float`/`Decimal` para dinero.
- [ ] El seed es idempotente y no duplica la cuenta demo al re-ejecutarse.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

```bash
pnpm prisma migrate dev --name add_corporate_accounts
```

```bash
pnpm db:seed
```
