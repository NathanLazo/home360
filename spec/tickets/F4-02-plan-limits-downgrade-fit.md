# [F4-02] Completar `plan-limits.ts`: uso por recurso y `checkDowngradeFit`

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §3, §4 (`getCurrent`), §6; `spec/02-business-dashboard.md` §3
- **Depende de**: `F2-02` (`assertPlanLimit` ya creado)
- **Tamaño estimado**: S (< 1 h)

## Contexto

F2-02 creó `src/server/services/subscription/plan-limits.ts` con `assertPlanLimit`. F4 §3
completa el módulo con `checkDowngradeFit` (validación previa al cambio de plan) y el
cálculo de **uso vs. límites** que consume `subscription.getCurrent` (F4-06). Ambos
necesitan los mismos tres conteos, así que se extrae una función única `getPlanUsage`.

**Problemas detectados en la spec, resueltos aquí:**

1. La firma de la spec es `checkDowngradeFit(db, businessId, targetPlan)` sin decir si
   `targetPlan` es el `code`, el id o el objeto. **Resolución**: recibe los **límites ya
   resueltos** (`PlanLimits`), para no repetir la lectura del `Plan` que el router ya hizo
   y mantener el servicio libre de I/O innecesario.
2. La spec no define el criterio de "cabe": `assertPlanLimit` falla con `used >= max`
   (porque va a **agregar** un recurso más), pero un downgrade solo debe fallar si el uso
   **actual excede** el destino. **Resolución**: `checkDowngradeFit` marca exceso con
   `used > max` (empate = cabe). Documentar la asimetría en el archivo.
3. `getCurrent` (§4) pide `{ branches: { used, max }, … }` pero ninguna spec define dónde
   se arma. **Resolución**: helper `buildPlanUsageReport` en este mismo archivo; el router
   no calcula nada.
4. **Divergencia de tipos entre tickets ya escritos**: `F2-02` tipa el parámetro como
   `BusinessWithPlan = { id, subscription: { plan: … } | null }`, mientras `F0-05` aplana el
   contexto a `ctx.business = { id, status, plan: PlanLimits | null }`. **Resolución**: la
   forma canónica es la de `F0-05`; al abrir el archivo, adaptar el tipo existente al del
   `ctx` real si divergió (sin crear un tipo paralelo ni castear). Registrado en
   `F3-F4-findings.md` #12.

## Alcance

Modificar:

- `src/server/services/subscription/plan-limits.ts`

Crear:

- `src/lib/subscription/plan-codes.ts`

Fuera de alcance: cambio de plan (F4-04), router (F4-06), cualquier cambio de schema.

## Detalle técnico

`plan-codes.ts` — fuente canónica compartible de los códigos de plan. No importa Prisma,
Stripe ni módulos server-only. F4-04 y F4-06 la importan; el contrato de integración para
`F5-05 approveBusiness` exige reemplazar su
`z.enum(["basic", ...])` local por `planCodeSchema` cuando se implemente F5:

```ts
import { z } from "zod";

export const PLAN_CODES = ["basic", "standard", "enterprise"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export const planCodeSchema = z.enum(PLAN_CODES);
```

`plan-limits.ts` — se **agrega** (sin tocar el comportamiento de `assertPlanLimit`):

```ts
export type PlanLimits = {
  maxBranches: number | null;
  maxWorkers: number | null;
  maxProducts: number | null;
};

export const LIMITED_RESOURCES = ["branches", "workers", "products"] as const;
export type LimitedResource = (typeof LIMITED_RESOURCES)[number];
export type PlanUsage = Record<LimitedResource, number>;

export type PlanUsageReport = Record<LimitedResource, { used: number; max: number | null }>;

export async function getPlanUsage(db: PrismaClient, businessId: string): Promise<PlanUsage>;

export async function checkDowngradeFit(
  db: PrismaClient,
  businessId: string,
  targetPlan: PlanLimits,
): Promise<{ fits: boolean; exceeds: LimitedResource[]; usage: PlanUsage }>;

export function buildPlanUsageReport(usage: PlanUsage, plan: PlanLimits): PlanUsageReport;
```

- `getPlanUsage`: tres `count` en un solo `Promise.all`, con los **mismos filtros** que ya
  usa `assertPlanLimit` (F2-02): `branches` = todas las sucursales, `workers` = todos los
  workers, `products` = solo `status: "PUBLISHED"`. `assertPlanLimit` debe refactorizarse
  para reusar el mismo mapa de conteo (una sola definición de "qué cuenta cada recurso"),
  conservando su optimización de **no** consultar cuando `max === null`.
- `checkDowngradeFit`: `exceeds` en orden estable `["branches", "workers", "products"]`;
  un recurso entra si `max !== null && used > max`. `fits = exceeds.length === 0`.
  Nunca lanza: es una consulta de lectura pura.
- `buildPlanUsageReport`: sin I/O; `max` se copia tal cual (`null` = ilimitado, la UI lo
  traduce).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] `assertPlanLimit` y `checkDowngradeFit` comparten una sola definición de conteo por
      recurso (sin duplicar `where`).
- [ ] `checkDowngradeFit` no consulta Stripe ni lanza; `exceeds` en orden estable.
- [ ] F4 no duplica códigos de plan; queda documentado el import obligatorio para F5-05.

## Comandos para Roger (si aplica)

—
