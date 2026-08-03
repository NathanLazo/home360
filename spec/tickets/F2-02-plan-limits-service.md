# [F2-02] Servicio compartido de límites de plan (`assertPlanLimit`)

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §3 (límite de plan); `spec/04-subscriptions.md` §3; `spec/00-foundations.md` §4–§5
- **Depende de**: F0 completo (contrato, `businessProcedure` con plan en ctx)
- **Tamaño estimado**: S

## Contexto

Los routers de productos (publicar) y sucursales (crear) de F2 deben rechazar operaciones
que excedan el plan del negocio con `PLAN_LIMIT_REACHED`. F4 reutiliza y amplía este
servicio (`checkDowngradeFit` queda **fuera** de este ticket, llega en F4).

**Problemas detectados en la spec, resueltos aquí:**

1. F2 §3 escribe `ctx.business.plan.maxProducts`, pero F0 §5 define el ctx como
   `{ id, status, subscription: { plan: { … } } }`. Resolución: la forma canónica es la
   de F0 — el plan vive en `ctx.business.subscription?.plan`.
2. `subscription` es anulable (un negocio PENDING no tiene plan, F1 §2). Aunque las
   mutations usan `activeBusinessProcedure`, el tipo obliga a manejar `null`. Resolución:
   `subscription === null` → `fail("BUSINESS_NOT_ACTIVE", 403, …)` (código ya existente
   en `ERROR_CODES`).
3. La spec no dice qué cuenta cada recurso. Resolución: `branches` = todas las sucursales
   (activas y pausadas), `workers` = todos los workers, `products` = solo `PUBLISHED`
   (coherente con F2 §3 y F4 §3).

## Alcance

Crear:

- `src/server/services/subscription/plan-limits.ts`

Fuera de alcance: `checkDowngradeFit` (F4), invocación desde routers (tickets F2-07 y
F2-10), cambios de schema.

## Detalle técnico

```ts
import type { PrismaClient } from "generated/prisma";
import { fail, type TrpcResponse } from "~/server/api/contract";

export type LimitedResource = "branches" | "workers" | "products";

export type BusinessWithPlan = {
  id: string;
  subscription: {
    plan: { maxBranches: number | null; maxWorkers: number | null; maxProducts: number | null };
  } | null;
};

export async function assertPlanLimit(
  db: PrismaClient,
  business: BusinessWithPlan,
  resource: LimitedResource,
): Promise<TrpcResponse<null> | null>;
```

Comportamiento (retorna `null` cuando la operación está permitida):

1. `business.subscription === null` → `fail("BUSINESS_NOT_ACTIVE", 403, "Business has no active plan")`.
2. `max` del recurso `=== null` → ilimitado → `null`.
3. Conteo (una sola query `count` filtrada por `businessId`):
   - `branches`: `db.branch.count({ where: { businessId } })`
   - `workers`: `db.worker.count({ where: { businessId } })`
   - `products`: `db.product.count({ where: { businessId, status: "PUBLISHED" } })`
4. `used >= max` → `fail("PLAN_LIMIT_REACHED", 409, "Plan limit reached for <resource>")`.

El tipo `BusinessWithPlan` debe ser **asignable desde** el `ctx.business` que produce
`businessProcedure` (F0 §5) — no introducir un tipo paralelo incompatible.

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

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Revisión manual de los cuatro caminos: alcanzado, `null` ilimitado, por debajo del
      límite y `BUSINESS_NOT_ACTIVE`; no se crean tests automatizados.
- [ ] El tipo del parámetro `business` acepta el `ctx.business` real sin casts.

## Comandos para Roger (si aplica)

—
