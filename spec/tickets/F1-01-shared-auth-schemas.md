# [F1-01] Crear schemas Zod compartidos de auth y códigos de error del módulo

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §1, §2, §4 · `spec/README.md` (contrato e i18n) · `spec/00-foundations.md` §4
- **Depende de**: F0 completada (schema Prisma con enums `BusinessType`/`GuaranteeType`, `src/server/api/contract.ts` con `ErrorCode`)
- **Tamaño estimado**: S

## Contexto

**Problema detectado en la spec**: `spec/01-auth.md` §4 declara `login.schema.ts` dentro de
`login/_components/` como "compartido con authorize", y `register.schema.ts` dentro de
`register/_components/` mientras el servicio `register-business.ts` (servidor) valida el mismo
input. Eso obligaría al servidor a importar desde el `_components/` de una página, lo que
contradice la convención roger-arq #2 ("nada se importa desde el `_components` de otro módulo")
y acopla el servidor a la UI.

**Resolución elegida**: los schemas viven en una carpeta isomórfica `src/schemas/auth/`
(puro Zod + enums de Prisma, importable desde cliente y servidor). Los archivos
`_components/*.schema.ts` que la spec lista se crean en F1-07/F1-08 como re-exports delgados
para conservar la localidad de módulo. Los códigos de error propios del módulo se declaran
aquí como unión cerrada según F0 §4. Además, la política de contraseña vive en un schema
propio para que registro y recuperación usen exactamente los mismos límites.

## Alcance

Crear:

- `src/schemas/auth/login.schema.ts`
- `src/schemas/auth/password.schema.ts`
- `src/schemas/auth/register-business.schema.ts`
- `src/schemas/auth/auth-errors.ts`

Fuera de alcance: cualquier UI, el servicio de registro, la configuración de NextAuth,
los re-exports en `_components/` (F1-07 y F1-08).

## Detalle técnico

`login.schema.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

(`min(1)` y no `min(8)` en login: la política de longitud aplica al alta, no al inicio de
sesión; el error de credenciales es siempre genérico.)

`password.schema.ts`:

```ts
import { z } from "zod";

export const passwordSchema = z.string().min(8).max(72);
export type PasswordInput = z.infer<typeof passwordSchema>;
```

Los mensajes visibles no se escriben en el schema: la UI traduce cada issue por clave de
`auth.json`. Nunca incluir contraseñas ni emails dentro de mensajes de error.

`register-business.schema.ts` — un schema por paso del wizard (spec §4) y el schema
completo por composición. Los enums se importan del cliente Prisma generado
(`generated/prisma`) — son objetos const planos, seguros en cliente:

```ts
import { z } from "zod";
import { BusinessType, GuaranteeType } from "../../../generated/prisma";
import { passwordSchema } from "./password.schema";

export const registerAccountStepSchema = z.object({
  ownerName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema, // 72 = límite efectivo de bcrypt
});

export const registerBusinessStepSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  businessType: z.nativeEnum(BusinessType),
});

export const registerGuaranteeStepSchema = z.object({
  guaranteeType: z.nativeEnum(GuaranteeType),
  guaranteeNotes: z.string().trim().max(500).optional(),
});

export const registerBusinessSchema = registerAccountStepSchema
  .merge(registerBusinessStepSchema)
  .merge(registerGuaranteeStepSchema);

export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;
```

Usar ese import relativo exacto; este ticket no modifica `tsconfig.json` ni la configuración
de generación de Prisma.

`auth-errors.ts`:

```ts
import { type ErrorCode } from "~/server/api/contract";

export const AUTH_ERROR_CODES = [
  "EMAIL_TAKEN",
  "INVALID_TOKEN",
  "TOO_MANY_REQUESTS",
] as const;

export type AuthErrorCode = ErrorCode | (typeof AUTH_ERROR_CODES)[number];
```

Nota: `contract.ts` solo contiene tipos y helpers puros; importar `ErrorCode` (type-only)
desde un archivo isomórfico es seguro.

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

- [ ] Los cuatro archivos existen; `pnpm typecheck`, `pnpm check` y `pnpm build` pasan en verde.
- [ ] `registerBusinessSchema.safeParse` rechaza password < 8, email inválido y `businessType` fuera del enum, sin crear archivos de prueba.
- [ ] `loginSchema` normaliza el email (trim + lowercase) en el propio parseo.
- [ ] `AuthErrorCode` incluye exactamente los códigos de módulo usados por F1 y no usa `string` abierto.
- [ ] Ningún archivo de `src/schemas/` importa nada de `src/app/` ni de `src/server/` (salvo el type-only `ErrorCode` del contrato).

## Comandos para Roger (si aplica)

—
