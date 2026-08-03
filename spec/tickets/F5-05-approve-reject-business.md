# [F5-05] Implementar aprobación y rechazo de negocios (`approveBusiness` / `rejectBusiness`)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §2, `spec/04-subscriptions.md` §2 (crear Subscription al aprobar), `spec/03-payments.md` §3 (onboarding Connect)
- **Depende de**: `F5-04`, `F4-03` y `F4-06`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Aprobación de un negocio PENDING: transacción local que lo activa y crea su suscripción,
sin meter Stripe en el commit; y rechazo con razón.

**Problemas detectados y resolución**:

1. La spec pide una cuenta Connect placeholder al aprobar, pero eso impide que el banner
   de onboarding de F3 se muestre. **Resolución técnica ya determinada por
   `PENDIENTES.md`**: `approveBusiness` **no crea ni persiste** una cuenta Connect. El
   negocio inicia su propio onboarding con `payment.startOnboarding`; mientras
   `payoutsEnabled`/`chargesEnabled` no estén activos no puede recibir liberaciones ni
   retiros.
2. `REJECTED` y `Business.statusReason` ya pertenecen al schema inicial de `F0-03`; F5
   solo los consume. Este ticket no abre una migración tardía ni vuelve a editar Prisma.
3. El alta local sí depende de F4: crea `Subscription` dentro de la transacción y luego
   llama al servicio idempotente `ensureBillingSubscription` de `F4-03`, fuera del commit.
   La política de cobro de la suscripción sigue abierta en `PENDIENTES.md` §4: este ticket
   **no elige** Portal, Elements ni `send_invoice`; usa exactamente el contrato que Roger
   haya cerrado en F4. Hasta entonces, la sincronización Stripe de este paso está
   **bloqueada**, aunque aprobación + suscripción local sí son implementables.

## Alcance

Crear/modificar:

- `src/server/services/admin/approve-business.ts` · `reject-business.ts`.
- `src/server/api/routers/admin/users.ts` — query `listApprovalPlans` y mutations
  `approveBusiness`, `rejectBusiness`.
- `src/app/[locale]/admin/users/_components/approve-business-dialog.tsx`,
  `use-user-mutations.ts` (nuevo), y extender `user-row-actions.tsx` +
  `business-detail-sheet.tsx` (footer) con Aprobar/Rechazar (visibles solo si PENDING).
- `src/messages/{es,en}/admin.json` + `errors.json` si hay código nuevo.

Fuera de alcance: suspender/reactivar (F5-06), UI de W9.

## Detalle técnico

`approveBusiness` — input `{ businessId: cuid, planCode: z.enum(["basic","standard","enterprise"]) }`:

```ts
// src/server/services/admin/approve-business.ts
approveBusiness({ db, billing, businessId, planCode })
// 1. Plan por code → sin plan: NOT_FOUND.
// 2. db.$transaction:
//    a. updateMany Business { id, status: PENDING } → { status: ACTIVE, statusReason: null }
//       count === 0 → CONFLICT (no estaba PENDING: idempotencia/carrera resuelta)
//    b. create Subscription { businessId, planId, status: ACTIVE, renewsAt: now + 1 mes }
//       (Business.subscription es 1:1 @unique: doble create imposible)
// 3. Post-commit: invocar ensureBillingSubscription de F4 con idempotencia.
//    Si falla, registrar el código estable para reintento/observabilidad; no revertir el
//    commit local ni inventar otra política de cobro.
// 4. NO crear cuenta Connect ni escribir stripeAccountId. El onboarding es de F3.
// 5. svcOk({ id: businessId })
```

`rejectBusiness` — input `{ businessId: cuid, reason: z.string().trim().min(5).max(500) }`:

- `updateMany { id, status: PENDING } → { status: REJECTED, statusReason: reason }`;
  count 0 → `CONFLICT`. No crea Subscription ni toca Stripe. Retorna `{ id }`.

Ambos servicios retornan `ServiceResult`; las procedures `adminProcedure` adaptan a
`TrpcResponse<{ id: string }>` con las cuatro claves obligatorias.

`listApprovalPlans` (`adminProcedure.query`) retorna
`TrpcResponse<Array<{ code: PlanCode; priceCents: number; commissionPct: number;
isAvailable: boolean }>>`, ordenado por `priceCents`, con `select` mínimo.
`isAvailable = stripePriceId !== null`; el id de Stripe no se expone. No se reutiliza
`subscription.listPlans`, porque esa procedure está protegida para rol BUSINESS.

UI:

- `approve-business-dialog.tsx`: Dialog desde row-actions/sheet (solo PENDING): resumen de
  garantía (`guarantee-badge` + `guaranteeNotes`) y documentos con su estado, más `Select`
  de plan inicial. Ningún ticket inventa una regla de aprobación automática por
  documentos: si Roger exige tipos/estados mínimos, debe documentarlo antes. Los planes,
  precios y disponibilidad salen de `admin.users.listApprovalPlans`; no se duplican
  constantes monetarias en F5. Default `standard` solo si está disponible; en otro caso,
  el primer plan disponible. Éxito → toast + invalida `admin.users.list`,
  `getBusinessDetail` y
  `admin.overview.*`.
- Rechazo: `AlertDialog` con `Textarea` de razón obligatoria (reutilizar
  `confirm-dialog` si admite children; si no, componente propio `reject-business-dialog.tsx`).
- `use-user-mutations.ts`: hooks de ambas mutations con manejo de `error` → toast
  traducido desde `errors.json`.

Comportamiento a verificar manualmente:

- Aprueba PENDING → Business ACTIVE + Subscription creada con el plan elegido.
- Segundo approve → `CONFLICT` (idempotencia).
- Falla de Stripe post-commit no revierte ACTIVE ni la Subscription local y queda
  observable/reintentable por el servicio `ensure*` de F4.
- `rejectBusiness` no crea Subscription y persiste `statusReason`.
- La aprobación deja `stripeAccountId` sin cambios; el negocio ve el onboarding de F3.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse`; errores como códigos estables (`CONFLICT`, `NOT_FOUND`).
- `adminProcedure`; 403 uniforme.
- Transacción Prisma para lo atómico local; llamadas Stripe fuera de la transacción,
  encapsuladas por el servicio Billing inyectado.
- TypeScript estricto: sin `any`.
- Identificadores en inglés; copy vía next-intl.
- BD: este ticket no cambia schema ni ejecuta comandos de datos.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- [ ] Con seed: aprobar "Eléctrica Volta" con plan standard → badge ACTIVE en
      W10, Subscription visible en el sheet, fila desaparece de pendientes de W9.
- [ ] Re-aprobar → toast de error `CONFLICT` traducido.
- [ ] Rechazar un negocio PENDING → badge "Rechazado" y razón visible en el sheet.
- [ ] Aprobar no crea una cuenta Connect placeholder ni oculta el onboarding de W6.
- [ ] La procedure retorna siempre `{ result, error, status, message }`; éxito con
      `error: null`, y `CONFLICT` con `result: null`.

## Comandos para Roger (si aplica)

No aplica. La verificación de Billing requiere que Roger cierre antes la decisión de
`PENDIENTES.md` §4. La cuenta Connect se crea únicamente desde el onboarding de F3.
