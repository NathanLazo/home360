# [XC-05] Agregar estado REJECTED y statusReason al modelo Business

> Ticket transversal (pre-F0). Nace del hallazgo XC-05 de `spec/tickets/XC-findings.md`.

## Metadatos

- **Fase**: XC — corrección transversal de specs (aplicar antes de ejecutar F0)
- **Spec origen**: `spec/00-foundations.md` §3 (`BusinessStatus`, modelo `Business`) ·
  `spec/05-admin.md` §2
- **Depende de**: —
- **Tamaño estimado**: S

## Contexto

F5 §2 define `rejectBusiness { businessId, reason }` y `suspendBusiness { businessId,
reason? }`, pero `BusinessStatus` solo tiene `PENDING ACTIVE SUSPENDED` (sin estado
destino para el rechazo) y `Business` no tiene campo donde persistir la razón: el input
`reason` se pierde. Resolución elegida: nuevo valor de enum + campo único de razón de
estado.

## Alcance

- `spec/00-foundations.md` §3: enum `BusinessStatus` y modelo `Business`.
- `spec/05-admin.md` §2: transiciones y visualización de la razón.
- Fuera de alcance: código; flujo de re-aplicación de un negocio rechazado (no existe en
  el diseño).

## Detalle técnico

En `spec/00-foundations.md` §3:

```prisma
enum BusinessStatus { PENDING ACTIVE SUSPENDED REJECTED }

model Business {
  // …
  statusReason String?   // razón del último reject/suspend; null al aprobar/reactivar
}
```

En `spec/05-admin.md` §2, añadir la máquina de estados normativa:

```text
PENDING  → approveBusiness  → ACTIVE   (statusReason = null)
PENDING  → rejectBusiness   → REJECTED (statusReason = reason)
ACTIVE   → suspendBusiness  → SUSPENDED (statusReason = reason)
SUSPENDED → reactivateBusiness → ACTIVE (statusReason = null; CONFLICT si disputa abierta)
```

Y anotar: `business-detail-sheet.tsx` muestra `statusReason` cuando el estado es
`SUSPENDED` o `REJECTED`; el tab Negocios de W10 incluye los rechazados bajo el filtro de
estado. El login de un dueño con negocio `REJECTED` se comporta como `PENDING`/
`SUSPENDED`: `businessProcedure` pasa, `activeBusinessProcedure` bloquea (sin cambios en
F0 §5).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- TypeScript estricto: sin `any`; usar enums y tipos Prisma/Zod/tRPC.
- Identificadores en inglés; copy visible solo vía next-intl (es/en) — la razón se guarda
  tal cual la escribe el admin (texto libre), las etiquetas de estado se traducen.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones las corre Roger.

## Criterios de aceptación

- [ ] `spec/00` incluye `REJECTED` en el enum y `statusReason` en `Business`.
- [ ] `spec/05` §2 documenta las 4 transiciones con efecto sobre `statusReason`.
- [ ] `StatusBadge`/filtros citados en F5 §2 contemplan el nuevo estado.

## Comandos para Roger (si aplica)

—
