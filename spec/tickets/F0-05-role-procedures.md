# [F0-05] Implementar la jerarquía de procedures por rol

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §5; `spec/README.md` (jerarquía)
- **Depende de**: `F0-03`, `F0-04`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Extiende `src/server/api/trpc.ts` con `userProcedure`, `businessProcedure`,
`activeBusinessProcedure` y `adminProcedure`, conservando lo existente
(`createTRPCContext`, superjson, `timingMiddleware`, `publicProcedure`,
`protectedProcedure`).

**Problemas detectados y resoluciones**:

1. **El rol no existe aún en la sesión tipada**: F1 es quien configura JWT + callbacks,
   pero las guardas de F0 necesitan `session.user.role` tipado ya. **Resolución puente**:
   este ticket actualiza la module augmentation de `src/server/auth/config.ts`
   (`Session["user"]` gana `role: UserRole`, import del enum desde `generated/prisma`) y el
   callback `session` existente (estrategia database del adapter) copia `user.role` — el
   campo ya existe en el modelo por F0-03. F1 migrará a estrategia JWT sin romper el tipo.
2. **Contradicción F0 §5 vs F1 §2**: el `select` de `businessProcedure` asume
   `subscription.plan`, pero un negocio `PENDING` **no tiene** suscripción (F1: se crea al
   aprobar, F5). **Resolución**: `ctx.business.plan` es **nullable**; se aplana la forma a
   `{ id, status, plan: PlanLimits | null }`. Los servicios de límites (F2/F4) deben tratar
   `plan === null` como error `BUSINESS_NOT_ACTIVE`/estado no operativo. Registrado también
   en `F0-findings.md` para que la spec 02 lo aclare.

## Alcance

Modificar:

- `src/server/api/trpc.ts`
- `src/server/auth/config.ts` (solo augmentation + callback `session` con `role`)

Fuera de alcance: providers Credentials/Google, estrategia JWT, middleware de rutas (F1).

## Detalle técnico

Tipos y guardas en `trpc.ts`:

```ts
import type { UserRole } from "generated/prisma";   // vía path relativo o alias existente

type BusinessContext = {
  id: string;
  status: BusinessStatus;
  plan: {
    commissionPct: number;
    maxBranches: number | null;
    maxWorkers: number | null;
    maxProducts: number | null;
  } | null;
};

type CustomerContext = {
  id: string;
};
```

- `userProcedure = protectedProcedure.use(...)`: si `session.user.role !== "CUSTOMER"` →
  `throw new TRPCError({ code: "FORBIDDEN" })`. No hace consulta extra (no existe modelo de
  perfil de cliente); llama `next({ ctx: { ...ctx, customer: { id: session.user.id } } })`
  para cumplir la jerarquía normativa `CUSTOMER → ctx.customer`, con `CustomerContext`
  no-nulo obtenido por narrowing.
- `businessProcedure = protectedProcedure.use(async ...)`:
  1. `role !== "BUSINESS"` → `FORBIDDEN`.
  2. **Una sola query**: `ctx.db.business.findUnique({ where: { ownerId: session.user.id },
     select: { id: true, status: true, subscription: { select: { plan: { select: {
     commissionPct: true, maxBranches: true, maxWorkers: true, maxProducts: true } } } } } })`.
  3. Sin negocio → `FORBIDDEN` (mismo mensaje: no revelar existencia).
  4. `next({ ctx: { ...ctx, business } })` con `business: BusinessContext` no-nulo por
     narrowing (aplanar `subscription?.plan ?? null` a `plan`).
- `activeBusinessProcedure = businessProcedure.use(...)`: `business.status !== "ACTIVE"` →
  `FORBIDDEN` (la UI distingue PENDING/SUSPENDED por otra vía; la guarda no filtra info).
- `adminProcedure = protectedProcedure.use(...)`: `role !== "ADMIN"` → `FORBIDDEN`.

Reglas:

- Las guardas lanzan `TRPCError` **solo** `UNAUTHORIZED`/`FORBIDDEN` (infraestructura);
  todo lo demás en el proyecto retorna `TrpcResponse` (F0-04). No usar `errorFormatter`
  para el contrato.
- Sin casts: el narrowing sale de los checks y del `select` tipado por Prisma.
- `userProcedure` expone `ctx.customer.id`; nunca recibe un `customerId` del input para
  decidir identidad o alcance.

En `config.ts`:

```ts
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
  interface User { role: UserRole }
}
```

y `session: ({ session, user }) => ({ ...session, user: { ...session.user, id: user.id, role: user.role } })`.

Comprobación manual/estructural (sin crear tests): cada procedure rechaza roles incorrectos
con `FORBIDDEN`; sin sesión → `UNAUTHORIZED`; `businessProcedure` con negocio PENDING pasa
pero `activeBusinessProcedure` lo rechaza; `ctx.business.plan` es `null` cuando no hay
suscripción. El agente verifica estos caminos por revisión del narrowing y por compilación;
los datos demo se recorren manualmente después de que Roger ejecute migración y seed.

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

- [ ] Las 4 procedures nuevas exportadas; `ctx` tipado por narrowing, sin casts;
      `userProcedure` expone `ctx.customer.id`.
- [ ] `businessProcedure` hace exactamente una consulta Prisma por request.
- [ ] `session.user.role` tipado (`UserRole`) y presente en runtime con la estrategia actual.
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm check` en verde.

## Comandos para Roger (si aplica)

— (ninguno).
