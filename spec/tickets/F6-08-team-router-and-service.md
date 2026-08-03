# [F6-08] Implementar el router `team` con límites de plan y guarda de eliminación

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §2 (`/dashboard/team`);
  `spec/04-subscriptions.md` §3 (`assertPlanLimit`); `spec/02-business-dashboard.md` §0
  (procedures por tipo de operación); `spec/08-business-model-alignment.md` D5 y D9
- **Depende de**: `F6-07`, `F2-02` (`assertPlanLimit`) y `F0-13` (`EmailClient`)
- **Tamaño estimado**: L

## Contexto

CRUD de `Worker` para el dashboard de negocio. Problemas detectados y resueltos aquí:

1. **Dependencia real con F2, no solo F1**: `assertPlanLimit` pertenece a `F2-02`.
   Este ticket lo consume y no crea ni modifica `plan-limits.ts`.
2. **Procedures**: F6 dice "router `team` (activeBusiness)" pero la regla F2 §0 es
   lecturas con `businessProcedure` y mutaciones con `activeBusinessProcedure`.
   Resolución: `list` → `businessProcedure`; `create/update/delete` →
   `activeBusinessProcedure` (coherente con el resto del dashboard).
3. **Guarda de eliminación verificable**: el CONFLICT ("único worker asignado a un
   servicio activo") **sí es verificable** con el m2m implícito `Service.workers` de
   spec/00, pero solo por consulta (no existe constraint de BD posible). Resolución:
   verificación y delete dentro de una transacción para minimizar la carrera (riesgo
   residual documentado en `F6-findings.md`).
4. **Trabajador rico e invitación**: D5 ya aporta especialidad, email y estado de
   invitación; D9 asigna a F6-08 el correo vía Resend. El alta acepta email opcional,
   persiste `PENDING`, envía mediante `EmailClient` inyectado y permite reenviar. No se
   crea cuenta de usuario ni flujo de aceptación: pertenecen a la app móvil.

## Alcance

Crear/modificar:

- `src/server/services/team/worker-team.ts` (nuevo)
- `src/server/services/team/send-worker-invitation.ts` (nuevo)
- `src/server/api/routers/team.ts` (nuevo)
- `src/server/api/root.ts` (registrar `team`)
- `src/messages/{es,en}/emails.json` (namespace `workerInvitation` del correo).
- `src/messages/{es,en}/errors.json` (`EMAIL_SEND_FAILED`).

Fuera de alcance: UI (F6-09); asignación worker↔service (se gestiona desde W4);
vinculación `Worker.userId`, token/aceptación de invitación y acceso de trabajador
(app móvil); cambios a `plan-limits.ts`, adaptador Resend o schema.

## Detalle técnico

Todas las procedures retornan `TrpcResponse` (`ok`/`fail`/`normalizeError` de
`src/server/api/contract.ts`). Tenant siempre `ctx.business.id` dentro del `where`.

| Procedure | Proc | Input (Zod) | Result / Errores |
|-----------|------|-------------|------------------|
| `list` (query) | business | — | `{ items: WorkerListItem[], limit: { used, max: number \| null, canCreate: boolean } }` |
| `create` (mutation) | active | `{ fullName: min(2), branchId?: cuid \| null, specialty?: min(2), invitedEmail?: email, locale: "es" \| "en" }` | `{ id }` · `PLAN_LIMIT_REACHED` · `NOT_FOUND` · `EMAIL_SEND_FAILED` |
| `update` (mutation) | active | `{ id: cuid, fullName?: min(2), branchId?: cuid \| null, specialty?: min(2) \| null }` | `{ id }` · `NOT_FOUND` |
| `delete` (mutation) | active | `{ id: cuid }` | `{ id }` · `NOT_FOUND` · `CONFLICT` (409) |
| `resendInvitation` (mutation) | active | `{ id: cuid, locale: "es" \| "en" }` | `{ id }` · `NOT_FOUND` · `CONFLICT` · `EMAIL_SEND_FAILED` |

```ts
type WorkerListItem = {
  id: string;
  fullName: string;
  specialty: string | null;
  invitedEmail: string | null;
  invitationStatus: InvitationStatus;
  branch: { id: string; name: string } | null;
  services: Array<{ id: string; name: string; status: ServiceStatus }>;
};
```

Servicio `worker-team.ts`:

- `listWorkers(db, business)`: filtra por `business.id`, usa `select` mínimo con campos de invitación, `branch { id, name }` y
  `services { id, name, status }`; `limit.used` = count de workers del negocio,
  `limit.max` = `business.subscription?.plan.maxWorkers ?? null`; `canCreate` solo es
  true para negocio ACTIVE con suscripción y cupo disponible (`max === null` significa
  ilimitado únicamente cuando existe suscripción). Orden `fullName asc`.
- `createWorker(db, business, input)`: primero
  `assertPlanLimit(db, business, "workers")` → si retorna `TrpcResponse`, propagarla.
  Si `branchId` viene: verificar `branch.businessId === business.id` con
  `findFirst({ where: { id, businessId } })` → si no, `fail("NOT_FOUND", 404, …)`.
  Si hay `invitedEmail`, normalizarlo, crear el worker con `invitationStatus: PENDING` y,
  tras persistir, llamar `sendWorkerInvitation(emailClient, { locale, ... })`. El adaptador
  se inyecta; router/servicio nunca importan `resend`.
- `updateWorker`: `updateMany({ where: { id, businessId }, data })` → `count === 0` ⇒
  `NOT_FOUND`. `branchId: null` desasigna; si viene id, misma validación de pertenencia.
  El schema exige al menos uno de los campos editables además de `id`.
- `deleteWorker(db, businessId, id)` en `db.$transaction`:
  1. `service.findMany({ where: { businessId, status: "ACTIVE", workers: { some: { id } } },
     select: { id, name, _count: { select: { workers: true } } } })`.
  2. Si alguno tiene `_count.workers === 1` → `fail("CONFLICT", 409,
     "worker is the only one assigned to active service(s)")` (el `message` es referencia;
     la UI traduce por código).
  3. Si no, `worker.delete({ where: { id, businessId } })` (extended where unique);
     Prisma desconecta el m2m implícito automáticamente.
  4. Worker inexistente/ajeno → `NOT_FOUND` (P2025 vía `normalizeError`).

`resendInvitation` busca con `{ id, businessId }`, exige `invitationStatus === PENDING` e
`invitedEmail !== null`; otro estado → `CONFLICT`. Reenvía con `EmailClient`. El asunto y
cuerpo salen de traducciones es/en; nunca se hardcodean en el servicio ni incluyen
secretos. Un fallo de proveedor se normaliza a `EMAIL_SEND_FAILED` (502), sin borrar al
worker ni filtrar el error de Resend.

Router `team.ts`: capa delgada sobre el servicio; `catch (error: unknown)` →
`normalizeError`.

Comportamiento a verificar manualmente contra el seed (no hay pruebas automatizadas):

- `create` con límite alcanzado → `PLAN_LIMIT_REACHED`; `maxWorkers: null` → pasa.
- `create` con branch de otro negocio → `NOT_FOUND`.
- `delete` de worker único en servicio ACTIVE → `CONFLICT`; con servicio PAUSED o con 2
  workers → éxito.
- `delete` con id de otro tenant → `NOT_FOUND` y no muta el worker.
- alta con correo → `PENDING` + correo en locale solicitado; reenvío solo para `PENDING`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Prisma con `select` explícito y mínimo; operaciones atómicas en transacción.

## Criterios de aceptación

- [ ] Las 5 procedures registradas en `appRouter` con los códigos de error de la tabla.
- [ ] Imposible leer/mutar workers de otro negocio (filtro de tenant en cada query).
- [ ] Invitación y reenvío usan `EmailClient` inyectado, copy es/en y estado `PENDING`;
      no crean cuentas ni tokens.
- [ ] Casos de límite, branch ajena, conflicto y tenant ajeno verificados manualmente.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Roger confirma que la migración inicial de `F0-12` está aplicada antes del recorrido
manual. Este ticket no prescribe ni ejecuta comandos de BD.
