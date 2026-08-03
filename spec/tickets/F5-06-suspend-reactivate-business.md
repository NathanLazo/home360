# [F5-06] Implementar suspensión y reactivación de negocios

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §2 (suspendBusiness / reactivateBusiness, suspend-business-dialog)
- **Depende de**: `F5-05` (columna `Business.statusReason` y `use-user-mutations.ts`)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Mutations de estado sobre negocios ACTIVE/SUSPENDED, con las entradas contextuales del
dropdown de W10.

**Problemas detectados y resolución**:

1. La spec dice: input `{ businessId, reason? }` con reason **opcional**, pero el dialog
   es "AlertDialog con razón obligatoria". **Resolución**: la firma compartida de la spec
   explica el `?` porque cubre ambas mutations; se separa: `suspendBusiness` exige
   `reason` (obligatoria, se persiste en `statusReason`); `reactivateBusiness` no lleva
   razón (y limpia `statusReason`).
2. "`CONFLICT` si tiene disputa abierta (suspender no; reactivar sí bloqueado)" es
   ambiguo. **Resolución (lectura elegida)**: **suspender** un negocio con disputa
   abierta está **permitido** (caso realista: se suspende precisamente por la disputa);
   **reactivar** con disputa abierta está **bloqueado** → `CONFLICT` (no se devuelve la
   operación normal a un negocio con conflicto pendiente). Recomendación de aclarar la
   redacción en la spec → `F5-findings.md`.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/users.ts` — mutations `suspendBusiness`,
  `reactivateBusiness` (lógica en servicios).
- `src/server/services/admin/suspend-business.ts` · `reactivate-business.ts`.
- `src/app/[locale]/admin/users/_components/suspend-business-dialog.tsx`; extender
  `user-row-actions.tsx` (Suspender visible si ACTIVE/in_dispute; Reactivar si SUSPENDED)
  y `use-user-mutations.ts`.
- `src/messages/{es,en}/admin.json`.

Fuera de alcance: efectos sobre retiros del negocio suspendido (los cubre F5-11 con su
propio guard) y el bloqueo de mutations del negocio suspendido (ya lo hace
`activeBusinessProcedure` de F0).

## Detalle técnico

```ts
// suspendBusiness — input { businessId: cuid, reason: string.trim().min(5).max(500) }
// updateMany { id, status: ACTIVE } → { status: SUSPENDED, statusReason: reason }
// count 0 → CONFLICT (no estaba ACTIVE; cubre doble click / carrera → idempotente)
// Nota: disputa abierta NO bloquea (ver Contexto §2).

// reactivateBusiness — input { businessId: cuid }
// 1. count disputas { businessId, status != RESOLVED } > 0 → CONFLICT
// 2. updateMany { id, status: SUSPENDED } → { status: ACTIVE, statusReason: null }
//    count 0 → CONFLICT
// (1 y 2 dentro de db.$transaction con isolationLevel Serializable; reintento acotado
// ante P2034 para evitar carrera con apertura de disputa)
```

- Ambas retornan `TrpcResponse<{ id: string }>`.
- `suspend-business-dialog.tsx`: `AlertDialog` con `Textarea` de razón obligatoria
  (validada con el mismo schema Zod client-side), texto de advertencia ("el negocio no
  podrá operar ni retirar fondos"). Reactivar usa `confirm-dialog` compartido.
- Row-actions: Suspender solo con `derivedStatus in ["active","in_dispute"]`; Reactivar
  solo `"suspended"`. Éxito → invalidar `admin.users.list`, `getBusinessDetail`,
  `admin.overview.*`.
- Verificación manual: suspender ACTIVE persiste razón; suspender SUSPENDED → `CONFLICT`;
  reactivar con disputa abierta → `CONFLICT`; reactivar limpia `statusReason`.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse`; errores `CONFLICT`/`NOT_FOUND` estables.
- `adminProcedure`; 403 uniforme.
- Transacción Prisma en `reactivateBusiness` (guard + update atómicos).
- La reactivación usa aislamiento Serializable; una disputa abierta concurrentemente no
  puede quedar junto a una reactivación confirmada.
- TypeScript estricto: sin `any`.
- Identificadores en inglés; copy vía next-intl (es/en).
- Componentización: dialog y servicios en archivos propios.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- [ ] Suspender Plomería García exige razón, cambia el badge a Suspendido y muestra la
      razón en el sheet.
- [ ] Reactivar "Clima Norte MX" (sin disputas) lo regresa a Activo.
- [ ] Reactivar un negocio con disputa abierta → toast `CONFLICT` traducido.
- [ ] El dropdown solo ofrece acciones válidas para el estado de cada fila.
- [ ] Cada mutation retorna `{ result, error, status, message }`; no-admin recibe 403
      uniforme antes de consultar el negocio.

## Comandos para Roger (si aplica)

No aplica (usa la migración de F5-05).
