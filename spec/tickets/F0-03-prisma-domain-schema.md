# [F0-03] Escribir el schema Prisma completo del dominio

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §3; contrastado con `spec/01`–`spec/05`
- **Depende de**: `F0-01`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Define todos los enums y modelos del dominio en `prisma/schema.prisma`, conservando los
modelos NextAuth. Al revisar el schema de la spec contra lo que asumen F1–F5 se
detectaron los siguientes problemas; cada uno se resuelve en este ticket:

1. **Contradicción con F3 (links de cobro)**: `Payment.orderId` es obligatorio y único,
   pero F3 §5 exige crear un `Payment` para pagos vía `PaymentLink` que **no tienen
   orden**. **Resolución**: `orderId String? @unique` (opcional) y nuevo campo
   `paymentLinkId String? @unique` con relación 1–1 opcional a `PaymentLink`. Invariante de
   dominio (se valida en servicios, no en BD): todo Payment referencia exactamente una
   fuente (orden o link).
2. **Hueco con F5 (rechazo de negocios)**: `admin.users.rejectBusiness`/`suspendBusiness`
   reciben `reason`, pero ni existe estado `REJECTED` ni campo donde guardar la razón.
   **Resolución**: agregar `REJECTED` a `BusinessStatus` y campo `statusReason String?` en
   `Business` (última razón de rechazo/suspensión).
3. **Índices FK faltantes** (regla de la propia spec §3): `Order.serviceId`,
   `Order.productId` y `Review.customerId` no tenían `@@index`. Se agregan. También se
   cambia `Payment @@index([status])` por `@@index([status, escrowReleaseAt])` para la
   query de auto-liberación de F3 (`status = IN_ESCROW AND escrowReleaseAt <= now`).
4. **Consistencia menor**: `PlatformSettings` no tenía `createdAt` pese a la regla "todos
   los modelos persistentes con createdAt/updatedAt". Se agrega.
5. **Alineación con el deck** (`spec/08-business-model-alignment.md` D3): el bono de lealtad
   deja de ser "$150 por cada 50 órdenes" y pasa a ser un porcentaje del fee.
   **Resolución**: en `PlatformSettings`, eliminar los campos del bono por volumen
   (`loyaltyBonusCents` / `loyaltyBonusOrders` o como los nombre la spec §3) y sustituirlos
   por `loyaltyBonusPct Int @default(50)`.

6. **Inventario por sucursal**: `Product.stock` y `Product.lowStockThreshold` asumen que el
   inventario es del negocio, pero el stock es físico y vive en una sucursal concreta.
   **Resolución**: esos dos campos **no** se declaran en `Product` (que conserva SKU, nombre,
   precio, categoría y estado); se mueven a `ProductStock`, definido en `F0-12`. Un producto
   sin filas de stock existe en el catálogo con 0 unidades, que es justo lo que se quiere al
   darlo de alta.

Las **extensiones de marketplace** que reveló la app móvil (`Quote`, `LoyaltyBonus`,
`BusinessDocument`, campos ricos de `Worker` y `Order`) viven en `F0-12` para no volver este
ticket inmanejable. Ambos tickets editan `prisma/schema.prisma` **antes** de que Roger corra
la migración inicial: se aplican en orden y se migra una sola vez.

## Alcance

Modificar:

- `prisma/schema.prisma` — único archivo del ticket.

Después ejecutar **solo** `pnpm prisma generate`. Fuera de alcance: migración (Roger),
seed (F0-11), `stripeCustomerId` en `Business` (F4 lo agrega en su propia migración,
ver `F0-findings.md`).

## Detalle técnico

Copiar los enums y modelos EXACTAMENTE como aparecen en `spec/00-foundations.md` §3, con
estas desviaciones (las resoluciones del Contexto):

```prisma
enum BusinessStatus { PENDING ACTIVE SUSPENDED REJECTED }
```

`Business` — agregar tras `guaranteeNotes`:

```prisma
  statusReason    String?         // última razón de rechazo o suspensión (admin, F5)
```

`Payment` — reemplazar las dos primeras líneas de relación y los índices:

```prisma
model Payment {
  id                    String        @id @default(cuid())
  orderId               String?       @unique
  order                 Order?        @relation(fields: [orderId], references: [id])
  paymentLinkId         String?       @unique
  paymentLink           PaymentLink?  @relation(fields: [paymentLinkId], references: [id])
  // …resto igual que la spec…

  @@index([status, escrowReleaseAt])
}
```

`PaymentLink` — agregar el lado inverso: `payment Payment?`.

`Order` — agregar índices:

```prisma
  @@index([branchId])
  @@index([serviceId])
  @@index([productId])
```

`Review` — agregar `@@index([customerId])`.

`PlatformSettings` — agregar `createdAt DateTime @default(now())`.

Notas de verificación importantes:

- `User` gana `role UserRole @default(CUSTOMER)` y `passwordHash String?` — F0-05 y F1
  dependen de estos campos.
- `Order.folio Int @unique @default(autoincrement())` sobre PostgreSQL es válido en
  Prisma 6 (secuencia propia en columna no-id). El folio es **global** (no por negocio),
  consistente con el diseño "#1042".
- Conservar `Account`, `Session`, `VerificationToken` tal cual están, y en `User`
  mantener `accounts`/`sessions`.
- Mantener el generator existente (`prisma-client-js`, output `../generated/prisma`).
- Ambos lados de cada relación declarados; la relación `Worker ↔ Service` es m:n
  implícita (`workers Worker[]` / `services Service[]`), como en la spec.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm prisma generate` sin errores ni warnings de relaciones.
- [ ] Todos los enums y modelos de la spec §3 presentes, con las 6 desviaciones documentadas.
- [ ] Todo FK tiene `@@index` (o está cubierto por `@unique`/índice compuesto que lo tenga como primera columna).
- [ ] Todo campo de dinero es `Int` en centavos; todos los modelos de dominio tienen
      `createdAt`/`updatedAt` (los modelos NextAuth preservados conservan su forma existente).
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

**Solo después de que `F0-12` también esté aplicado sobre el schema** (una sola migración
inicial para ambos tickets). Tras revisar los archivos que genere:

```bash
pnpm prisma migrate dev --name init_home360_domain
```
