# [F4-06] Router tRPC `subscription`: plan actual, planes, preview, cambio y facturas

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §4 (tabla de procedures), §3; `spec/00-foundations.md` §4–§5
- **Depende de**: `F4-02`, `F4-03`, `F4-04`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Capa de transporte de F4: valida input con Zod, resuelve el tenant desde `ctx.business`
(nunca del input) y traduce `ServiceResult` → `TrpcResponse`. Respeta la división de la
spec §4: las lecturas son `businessProcedure` (un negocio PENDING/SUSPENDED puede *ver* su
estado) y las mutaciones que tocan Stripe son `activeBusinessProcedure`.

**Problemas detectados en la spec, resueltos aquí:**

1. §4 no define el resultado de `getCurrent` cuando el negocio **no tiene** suscripción
   (PENDING, o aprobado antes de F4). **Resolución**: `result: null` con `ok(...)` —no es
   un error—; la UI muestra un estado vacío ("Tu plan se activa al aprobar tu cuenta").
2. §4 pide `previewChange` "(upcoming invoice)" sin decir si es query o mutation.
   **Resolución**: **query** (lectura sin efectos) con `staleTime` corto en el cliente;
   `changePlan` es la única mutation.
3. `listInvoices { cursor? }` no define tamaño de página ni orden. **Resolución**:
   `take: 10`, orden `issuedAt desc`, cursor por `id` (mismo patrón que F3-11).
4. `PLAN_LIMIT_REACHED` con detalle: el contrato no lleva payload en el error; el detalle
   (`exceeds`) viaja en el resultado exitoso de `previewChange` (F4-04, findings #14).

## Alcance

Crear:

- `src/server/api/routers/subscription.ts`
- `src/lib/subscription/subscription.schemas.ts`

Modificar:

- `src/server/api/root.ts` (registrar el router `subscription`)
- `src/messages/{es,en}/errors.json` (claves de los códigos nuevos)

Fuera de alcance: UI (F4-08…F4-10), guarda de degradación (F4-07).

## Detalle técnico

`subscription.schemas.ts` — contrato compartido fuera de `_components` (ningún router
server importa un módulo privado de UI):

```ts
import { z } from "zod";
import { planCodeSchema } from "~/lib/subscription/plan-codes";   // F4-02

export const subscriptionErrorCodes = [
  "NO_SUBSCRIPTION", "PLAN_NOT_FOUND", "PLAN_NOT_SYNCED",
  "SAME_PLAN", "SUBSCRIPTION_NOT_ACTIVE",
] as const;
export type SubscriptionErrorCode = (typeof subscriptionErrorCodes)[number];

export const planChangeSchema = z.object({ planCode: planCodeSchema });
export const listInvoicesSchema = z.object({ cursor: z.string().cuid().optional() });
```

Procedures (todas retornan `TrpcResponse`; `try/catch` con `normalizeError` de F0):

| Procedure | Proc | Detalle |
|-----------|------|---------|
| `getCurrent` | business | Una query: `db.subscription.findUnique({ where: { businessId: ctx.business.id }, select: { status, renewsAt, plan: { select: { code, name, priceCents, commissionPct, maxBranches, maxWorkers, maxProducts } } } })`. Sin fila → `ok<CurrentSubscriptionResult \| null>(null, …)`. Con fila → `getPlanUsage` + `buildPlanUsageReport` (F4-02) → envelope `ok({ status, renewsAt, plan, usage: ... })` |
| `listPlans` | business | `db.plan.findMany({ where: { code: { in: PLAN_CODES } }, select: { code, name, priceCents, commissionPct, maxBranches, maxWorkers, maxProducts, stripePriceId } })`; validar con Zod que hay exactamente un registro por code y ordenar por `PLAN_CODES`, no por precio. Configuración inválida → `CONFLICT`. Mapear a `{ …, isCurrent, isAvailable }`; **no** exponer `stripePriceId` |
| `previewChange` | active | `planChangeSchema` → `previewPlanChange` (F4-04) → `{ currentPlanCode, targetPlanCode, prorationCents, effectiveAt, fits, exceeds }` · `NO_SUBSCRIPTION` 409 · `PLAN_NOT_FOUND` 404 · `PLAN_NOT_SYNCED` 409 · `SAME_PLAN` 409 · `STRIPE_ERROR` 502 |
| `changePlan` | active | `planChangeSchema` → `changePlan` (F4-04) → `{ planCode, prorationCents }` · `PLAN_LIMIT_REACHED` 409 · `SUBSCRIPTION_NOT_ACTIVE` 409 · resto igual que arriba |
| `listInvoices` | business | Query paginada sobre `Invoice` **filtrada por la suscripción del tenant** (`where: { subscription: { businessId: ctx.business.id } }`), `orderBy: { issuedAt: "desc" }`, `take: 11` (11.º = `nextCursor`), `select: { id, amountCents, status, issuedAt, pdfUrl }` → `{ items, nextCursor }` |

- Mapeo de `ServiceResult.code` → status HTTP: `NOT_FOUND`/`PLAN_NOT_FOUND` → 404;
  `CONFLICT`/`SAME_PLAN`/`PLAN_LIMIT_REACHED`/`PLAN_NOT_SYNCED`/`NO_SUBSCRIPTION`/
  `SUBSCRIPTION_NOT_ACTIVE` → 409; `STRIPE_ERROR` → 502.
- El `businessId` **jamás** viaja en el input: sale de `ctx.business.id` y va dentro del
  `where` de cada query (multitenancy en la consulta).
- `errors.json` (es/en) gana una clave por cada código de `subscriptionErrorCodes`; verificar
  que `PLAN_LIMIT_REACHED` y `STRIPE_ERROR` ya existan (F0-07/F2).
- Ningún monto se transforma aquí: los centavos viajan tal cual al cliente.
- Todo `Plan.code` leído de Prisma se valida con `planCodeSchema`; no se convierte con cast.
- El output público **siempre conserva el envelope**. Los componentes deben leer
  `query.data?.result` y `query.data?.error`; nunca tratar `RouterOutputs[...]` como si
  fuera directamente el plan/listado.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Roles correctos: lecturas `business`, `previewChange`/`changePlan` `active`.
- [ ] `getCurrent` de un negocio sin suscripción responde `result: null`, no error.
- [ ] `listInvoices` nunca devuelve facturas de otro negocio (filtro por relación en el `where`).
- [ ] Todos los códigos de error nuevos tienen clave en `errors.json` es/en.
- [ ] El router no importa archivos bajo `app/**/_components`.

## Comandos para Roger (si aplica)

—
