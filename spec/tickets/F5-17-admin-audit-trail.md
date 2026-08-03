# [F5-17] Registrar una bitácora transaccional de acciones administrativas

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/tickets/F5-findings.md` F5-14; transversal a
  `spec/05-admin.md` §2–§5
- **Depende de**: `F5-05`, `F5-06`, `F5-07`, `F5-11`, `F5-13`, `F5-16`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: **DESBLOQUEADO** respecto de F5-07/F5-11; registrar también las acciones
  monetarias aprobadas.

## Contexto

F5 cambia estados de cuentas, mueve o registra dinero y edita variables de riesgo sin
guardar quién actuó ni los valores anterior/nuevo. Este ticket agrega una bitácora
append-only. No crea una pantalla nueva: la trazabilidad queda disponible para operación
y soporte sin ampliar W9–W13.

## Alcance

Crear/modificar:

- `prisma/schema.prisma` — `AdminAuditAction`, `AdminAuditTarget` y `AdminAuditLog`; lado
  inverso en `User`.
- `src/server/services/admin/admin-audit.ts` — tipos, sanitización y helper de escritura.
- Servicios de mutations de F5-05, F5-06, F5-07, F5-11, F5-13 y F5-16 — escribir el evento
  en la misma transacción local que confirma el cambio de dominio.

Fuera de alcance: UI o router para explorar logs, exportación, retención/borrado,
observabilidad de Stripe y cambios realizados por negocios/clientes.

## Detalle técnico

Schema:

```prisma
enum AdminAuditAction {
  BUSINESS_APPROVED
  BUSINESS_REJECTED
  BUSINESS_SUSPENDED
  BUSINESS_REACTIVATED
  DISPUTE_MORE_EVIDENCE
  DISPUTE_RESOLVED
  WITHDRAWAL_APPROVED
  WITHDRAWAL_REJECTED
  SETTINGS_UPDATED
  LOYALTY_BONUS_PAID
  LOYALTY_BONUS_CANCELLED
}

enum AdminAuditTarget {
  BUSINESS
  DISPUTE
  WITHDRAWAL
  PLATFORM_SETTINGS
  LOYALTY_BONUS
}

model AdminAuditLog {
  id         String           @id @default(cuid())
  adminId    String
  admin      User             @relation(fields: [adminId], references: [id])
  action     AdminAuditAction
  targetType AdminAuditTarget
  targetId   String
  before     Json?
  after      Json?
  metadata   Json?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@index([adminId, createdAt])
  @@index([targetType, targetId, createdAt])
  @@index([action, createdAt])
}
```

- `adminProcedure` pasa `ctx.session.user.id` como `adminId` al servicio. El id nunca se
  acepta desde input cliente.
- `writeAdminAudit(tx, event)` recibe `Prisma.TransactionClient` y un `AdminAuditEvent`
  discriminado por `action`. Cada variante define snapshots permitidos; se serializa a
  `Prisma.InputJsonValue` mediante funciones exhaustivas, sin `any`, casts amplios ni
  objetos Prisma completos.
- Datos permitidos: ids internos, estados, `reasonPresent` booleano, montos en centavos, porcentajes,
  método de bono, campos settings anterior/nuevo y estado de grabación D6.
- Datos prohibidos: texto libre de razones/justificaciones, email, URL de
  documentos/evidencia/grabación, argumentos de disputa,
  datos bancarios, ids/tokens Stripe, stacks y mensajes de proveedor.
- El log se crea dentro de la misma transacción que el update local. Si la escritura del
  log falla, el cambio local falla. Para efectos Stripe, se registra solo al confirmar el
  estado local final; nunca se mantiene una transacción abierta durante la red.
- `MORE_EVIDENCE` registra estado anterior/nuevo y si D6 exigió justificación, pero no
  guarda el texto completo si puede contener datos personales; conserva un booleano y la
  justificación íntegra permanece en `Dispute.resolutionNotes`.
- `SETTINGS_UPDATED` registra únicamente campos que cambiaron, incluidos los tres planes,
  y comparte la transacción/control optimista de `admin.settings.save`.
- La tabla es append-only: no se crean procedures update/delete. Ningún `onDelete: Cascade`
  puede borrar historia al eliminar el target; solo la FK de `adminId` existe.

## Restricciones no negociables

- Contrato `{ result, error, status, message }` en toda procedure; este ticket no expone
  una procedure nueva.
- Todo acceso sigue protegido por `adminProcedure`; actor tomado de la sesión.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos Prisma/Zod y unión discriminada.
- Dinero en centavos; snapshots sin secretos ni datos bancarios/documentales.
- Escritura append-only y transaccional con el cambio local.
- **Sin pruebas automatizadas**: no se crean `*.test.ts`; verificación con
  `pnpm typecheck`, `pnpm check`, `pnpm build` y recorrido manual.
- El agente no ejecuta migraciones, seed, SQL ni comandos que borren datos.

## Criterios de aceptación

- [ ] Cada mutation administrativa completada genera exactamente un log con actor,
      acción, target, before/after mínimos y fecha.
- [ ] Un fallo al insertar el log revierte el cambio local; no hay llamadas Stripe dentro
      de la transacción.
- [ ] Dos admins concurrentes no generan dos eventos exitosos para una mutation protegida
      por `updateMany`; el perdedor recibe `CONFLICT`.
- [ ] Settings registra solo campos modificados y respeta `expectedUpdatedAt`.
- [ ] Ningún snapshot contiene PII sensible, URLs privadas, banco ni ids Stripe.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde, sin `any`.

## Comandos para Roger (si aplica)

Después de revisar la migración:

```bash
pnpm prisma migrate dev --name add_admin_audit_log
```
