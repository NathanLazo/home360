# [F0-11] Escribir el seed idempotente de desarrollo

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §9; contrastado con `spec/01` §6 y `spec/02` §7 (qué asume el seed)
- **Depende de**: `F0-02` (tsx/scripts), `F0-12` (schema final; a su vez depende de F0-03)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Crea la infraestructura idempotente del seed y sus datos base de identidad, planes,
negocios y catálogo. Los escenarios transaccionales (órdenes, pagos, disputas y bonos)
quedan en `F0-14` para mantener ambos tickets dentro del límite de 3–6 horas. El agente
**solo escribe archivos**; `pnpm db:seed` lo ejecuta Roger después de ambos tickets.

**Huecos detectados y resoluciones** (valores que la spec no define):

1. **Credenciales**: F1 verifica "login admin@home360.mx" y "login dueño de Plomería
   García" pero la spec no define contraseñas ni el email del dueño. **Resolución**:
   - Admin: `admin@home360.mx` / `Home360!admin`
   - Dueño demo: `garcia@plomeriagarcia.mx` / `Home360!demo`
   - Dueños PENDING/SUSPENDED: `contacto@electricavolta.mx`, `contacto@climanorte.mx`
     (misma contraseña demo). Hash con `hashPassword`-equivalente inline (`bcryptjs`,
     cost 12) — F1 moverá la función a `src/server/services/auth/password.ts`; el seed
     puede llamar `bcrypt.hash` directamente. Registrado en `F0-findings.md` por si Roger
     quiere otras credenciales.
2. **Idempotencia sin claves naturales**: sucursales, trabajadores, servicios y documentos
   no tienen una clave única natural suficiente para `upsert`. **Resolución**: IDs
   deterministas legibles (`"seed-branch-centro"`, `"seed-worker-01"`, …) y `upsert` por
   `id`. Planes van por `code`, settings por `id: 1`, usuarios por `email`, negocios por
   `ownerId` y productos por `businessId+sku`.
3. **Suscripciones**: un negocio ACTIVE debe tener plan (F0-05/F2 lo asumen).
   **Resolución**: Plomería García y Clima Norte MX con `Subscription` (standard, ACTIVE,
   `renewsAt` = +30 días); Eléctrica Volta (PENDING) **sin** suscripción — ejercita el
   caso `plan: null`.

## Alcance

Crear:

- `prisma/seed.ts` — orquestador; F0-14 lo amplía con escenarios.
- `prisma/seed/plans.ts`
- `prisma/seed/users.ts`
- `prisma/seed/businesses.ts`
- `prisma/seed/catalog.ts`

Cada módulo exporta una función idempotente con parámetros y retornos tipados; no usa estado
global oculto. Fuera de alcance de este ticket: órdenes, pagos, disputas, reseñas, retiros,
bonos, solicitudes y cotizaciones (F0-14).

Fuera de alcance: ejecutar el seed o migraciones (Roger), datos de Stripe reales
(`stripeAccountId`/`stripePriceId` quedan `null`).

## Detalle técnico

Datos (todo dinero en centavos):

- **Planes** (`upsert` por `code`) — escalera de comisión **10 / 8 / 5** por D1, precios sin
  cambio:
  `basic` 49900 / **10 %** / maxBranches 1 / maxWorkers 3 / maxProducts 50;
  `standard` 99900 / 8 % / 5 / 15 / `null`;
  `enterprise` 199900 / 5 % / `null` / `null` / `null`.
- **PlatformSettings** singleton `id: 1` con los defaults del schema (umbral IA 85, margen
  25, modelo "v3.2", revisión humana, tarifa de servicio 2500, **`loyaltyBonusPct: 50`**,
  72 h de auto-liberación, radio 10 km, recordatorio 24 h) — upsert explícito. Los campos
  del bono por volumen ya no existen (D3, ver `F0-03`).
- **Usuarios**: admin (role ADMIN), 3 dueños (role BUSINESS), ~5 clientes demo
  (role CUSTOMER, sin password: solo email/nombre) para órdenes y reseñas.
- **Negocios**:
  - "Plomería García": SERVICES, ACTIVE, guaranteeType COMBINED, 3 sucursales
    (Centro / Campestre / Zona Dorada, **Chihuahua** — es el mercado de arranque del deck,
    D8; nada de colonias de CDMX), 2 workers, 4 servicios (categorías "Plomería",
    precios/duraciones realistas, workers conectados), ~10 productos (SKUs `PG-001`…, uno
    DRAFT), suscripción standard. **Inventario por sucursal** (`ProductStock`, `F0-12`):
    cada producto con fila en las 3 sucursales; al menos uno bajo en una sola sucursal y
    sano en las otras (es el caso que la celda de stock consolidada debe saber advertir), y
    alguno sin fila en una sucursal (no se maneja ahí).
  - "Eléctrica Volta": SERVICES, PENDING, guaranteeType DEPOSIT, sin suscripción.
  - "Clima Norte MX": MIXED, SUSPENDED (`statusReason` con texto de ejemplo),
    suscripción standard.
- **Documentos de negocio** (`F0-12`): 3 de Plomería García en `APPROVED` (identificación,
  comprobante y póliza) y 2 de Eléctrica Volta en `PENDING`, para que el detalle de W10
  muestre los dos casos.
- **Trabajadores** (campos de `F0-12`): `specialty` ("Plomero", "Repartidor"),
  `availability` variada (`AVAILABLE` / `ON_SERVICE`), `branchId` asignado y uno con
  `invitationStatus: PENDING` + `invitedEmail`, para la tabla de equipo de F6.

Reglas de implementación:

- Import del cliente desde `../generated/prisma` (mismo patrón que `src/server/db.ts`);
  instancia propia de `PrismaClient` con `$disconnect()` en `finally` y `process.exitCode`
  en error.
- Sin `any`; tipar arrays de datos con `Prisma.XxxUncheckedCreateInput` cuando convenga
  (los `upsert` por id determinista permiten `create`/`update` simétricos).
- El seed debe poder correr dos veces sin duplicar nada. Roger decide cuándo ejecutarlo;
  este ticket no prescribe ni autoriza resets, recreaciones ni borrado de datos.

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

- [ ] `pnpm typecheck` en verde (el seed typechequea; NO se ejecuta).
- [ ] Cubre los planes, settings, usuarios, negocios, suscripciones, sucursales,
      trabajadores, servicios, productos, inventario y documentos definidos en este ticket.
- [ ] Todos los `upsert` usan claves deterministas; segunda ejecución = cero duplicados (revisable por lectura).
- [ ] Ninguna dirección de CDMX: la demo vive en Chihuahua.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde sin ejecutar el seed.

## Comandos para Roger (si aplica)

— (no ejecutar todavía; `F0-14` completa los escenarios y lista el comando final).
