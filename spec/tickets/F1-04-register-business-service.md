# [F1-04] Implementar servicio y procedure `auth.registerBusiness` (User BUSINESS + Business PENDING)

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §2 · `spec/README.md` (contrato tRPC, Prisma e i18n)
- **Depende de**: `F1-01` (registerBusinessSchema, AuthErrorCode), `F1-02` (hashPassword); F0 completada (contract.ts, appRouter)
- **Tamaño estimado**: M

## Contexto

Alta transaccional del negocio (spec §2): crea `User { role: BUSINESS, passwordHash }` +
`Business { status: PENDING }`; email duplicado → `EMAIL_TAKEN` (409). Sin sesión
automática. La suscripción NO se crea aquí (se crea al aprobar en F5).

**Problemas detectados en la spec y resolución**:

1. `EMAIL_TAKEN` es un código de dominio, no uno base. `F0-04` ya dejó `fail` genérico;
   este ticket usa `TrpcResponse<{ userId: string }, AuthErrorCode>` sin reabrir ni modificar
   el contrato transversal.
2. La spec pide "transacción Prisma". Un `create` anidado (`user.create` con
   `business: { create: … }`) ya es atómico en Prisma; se usa esa forma en lugar de
   `$transaction` explícito — cumple la intención (nunca queda User BUSINESS sin Business).

## Alcance

Crear:

- `src/server/services/auth/register-business.ts`
- `src/server/api/routers/auth.ts`

Modificar:

- `src/server/api/root.ts` (montar `auth: authRouter`)
- `src/messages/es/errors.json` y `src/messages/en/errors.json` (clave `EMAIL_TAKEN`)

Fuera de alcance: UI de `/register` (F1-08), login, aprobación del negocio (F5).

## Detalle técnico

### Servicio

Dependencia de BD inyectada por parámetro (mismo principio que F0 §8 para Stripe:
inyección para tests). Firma:

```ts
import { type PrismaClient } from "../../../../generated/prisma";

export const registerBusiness = async (
  db: PrismaClient,
  input: RegisterBusinessInput,
): Promise<TrpcResponse<{ userId: string }, AuthErrorCode>> => { … };
```

Pasos (spec §2):

1. El email ya llega normalizado por el schema (trim + lowercase en F1-01); no repetir.
2. `hashPassword(input.password)`.
3. Create anidado atómico:

```ts
const user = await db.user.create({
  data: {
    name: input.ownerName,
    email: input.email,
    role: UserRole.BUSINESS,
    passwordHash,
    business: {
      create: {
        name: input.businessName,
        type: input.businessType,
        status: BusinessStatus.PENDING,
        guaranteeType: input.guaranteeType,
        guaranteeNotes: input.guaranteeNotes ?? null,
      },
    },
  },
  select: { id: true },
});
return ok({ userId: user.id }, "Business registered, pending approval", 201);
```

4. `catch (error: unknown)`: si es `Prisma.PrismaClientKnownRequestError` con
   `code === "P2002"` → `fail("EMAIL_TAKEN", 409, "Email already registered")`; cualquier
   otro error → `normalizeError(error)` de `contract.ts` y
   `fail(code, status, "Business registration failed")`.
   Sin pre-check de email (se confía en el unique + P2002; evita la carrera).
5. El retorno jamás incluye `passwordHash`, datos de Prisma ni el input. El `select` queda
   limitado a `{ id: true }`.

### Router

`src/server/api/routers/auth.ts`:

```ts
export const authRouter = createTRPCRouter({
  registerBusiness: publicProcedure
    .input(registerBusinessSchema)
    .mutation(({ ctx, input }) => registerBusiness(ctx.db, input)),
});
```

`publicProcedure` (spec §2: el registro es público). Montar en `root.ts` como `auth`.
No acepta `businessId`, `ownerId`, `role` ni `status` desde input: esos valores se derivan
o fijan en servidor, por lo que el cliente no puede registrar dentro de otro tenant ni
autoaprobarse.

### i18n

`errors.json` (ambos locales) gana la clave `EMAIL_TAKEN`
(es: "Este correo ya está registrado", en: "This email is already registered").

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

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde; ningún `any`/cast.
- [ ] La mutation aparece en `appRouter.auth.registerBusiness` y devuelve el contrato `TrpcResponse` en éxito y en error.
- [ ] Éxito exacto: `{ result: { userId }, error: null, status: 201, message }`; email
      duplicado: `{ result: null, error: "EMAIL_TAKEN", status: 409, message }`.
- [ ] No se inicia sesión en el registro (la procedure no llama a `signIn`).
- [ ] `EMAIL_TAKEN` presente en `errors.json` es y en.

## Comandos para Roger (si aplica)

- Verificación en BD tras probar el flujo completo (F1-08): existe `User(role=BUSINESS)` con su `Business(status=PENDING)` y ninguna `Subscription`.
