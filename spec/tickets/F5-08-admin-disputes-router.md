# [F5-08] Implementar router `admin.disputes` (list, getById, resolve)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §3 (router), `spec/00-foundations.md` §3 (Dispute, Order.recordingUrl)
- **Depende de**: `F5-07`
- **Tamaño estimado**: M (1–3 h)
- **Estado**: bloqueado transitivamente mientras `F5-07` siga bloqueado. Las queries
  `list`/`getById` sí pueden implementarse; no exponer `resolve` parcialmente.

## Contexto

Capa tRPC de W11: listado con contadores, expediente completo y wiring de `resolve` al
servicio de F5-07.

**Verificación de campos contra `spec/00`** (todo existe): `aiSummary` ✓,
`evidenceUrls String[]` ✓, argumentos (`customerArgument`, `businessArgument?`) ✓; la
**grabación** no vive en `Dispute` sino en `Order.recordingUrl` — el expediente la expone
desde la orden. **No existe campo de duración** de la grabación: la UI la lee del
metadata del video (`onloadedmetadata`), decisión documentada aquí para F5-09.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/disputes.ts`; montar `disputes` en
  `src/server/api/routers/admin/index.ts` y migrar el conteo de `getSidebarStats`
  (F5-01) para reutilizar el mismo `where` (helper compartido en el router o servicio).
- `src/app/[locale]/admin/disputes/_components/disputes.schema.ts` · `disputes.types.ts`
  (schemas de input y tipos compartidos con la UI de F5-09).

Fuera de alcance: componentes de W11 (F5-09).

## Detalle técnico

```ts
// disputes.schema.ts
export const listDisputesSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),   // open = OPEN | IN_REVIEW
  cursor: z.string().cuid().optional(),
}).strict();
export const resolveDisputeSchema = z.object({
  disputeId: z.string().cuid(),
  resolution: z.nativeEnum(DisputeResolution),
  partialAmountCents: z.number().int().positive().optional(),
  justification: z.string().trim().min(20).max(1_000).optional(),
}).strict();
```

`list` (`adminProcedure.query`) — result:

```ts
{
  items: Array<{
    id; title; status: DisputeStatus; urgency: DisputeUrgency;
    businessName: string; customerName: string;
    orderFolio: number; amountCents: number;      // payment.amountCents, 0 si sin pago
    createdAt: Date; resolvedAt: Date | null; resolution: DisputeResolution | null;
  }>;
  nextCursor: string | null;
  openCount: number;              // status in [OPEN, IN_REVIEW]
  resolvedThisMonth: number;      // resolvedAt en mes calendario actual
}
// sin status → todas; orden estable con id como desempate
// take 20 + 1; cursor por id; nextCursor null al terminar
```

`getById` (`{ disputeId: cuid }`) — expediente completo:

```ts
{
  id; title; status; urgency; createdAt; resolvedAt; resolution; resolutionAmountCents;
  customerArgument: string; businessArgument: string | null;
  evidenceUrls: string[]; aiSummary: string | null; resolutionNotes: string | null;
  recordingUrl: string | null;                    // desde order.recordingUrl
  recordingComplete: boolean;
  recordingCompleteAtResolution: boolean | null;
  order: { id; folio; title; amountCents; status; createdAt };
  business: { id; name };
  customer: { id; name: string | null };          // order.customer
  payment: { id; status: PaymentStatus; amountCents; commissionCents;
             refundedCents } | null;              // null si la orden no tiene pago
}
// no existe → fail("NOT_FOUND", 404, ...)
```

`resolve` (`adminProcedure.mutation`, input `resolveDisputeSchema`): delega íntegro en
`resolveDispute` de F5-07 pasando `{ db: ctx.db, stripe }`; adapta `ServiceResult` al
contrato exacto `{ result, error, status, message }` y no contiene lógica monetaria.
Errores propagados mantienen el código del servicio F3/F5, incluida la validación de
reembolso parcial que Roger determine; no se remapean varios códigos al genérico
`VALIDATION_ERROR`.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse`; códigos estables.
- `adminProcedure` en las 3 procedures; 403 uniforme para no-admins.
- Procedures delgadas: `resolve` solo valida input y delega al servicio.
- TypeScript estricto: sin `any`; `z.nativeEnum` sobre enums Prisma.
- Prisma: `select` mínimo; `openCount`/`resolvedThisMonth` con `count` en `Promise.all`.
- Dinero en centavos.
- Ninguna procedure retorna resultados desnudos; éxito tiene `error: null` y fallo
  `result: null`.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Con seed: `list()` retorna las 2 disputas, la URGENT primera; `openCount` correcto.
- [ ] `getById` de la disputa URGENT incluye `aiSummary`, `evidenceUrls`, argumentos,
      `recordingUrl` de la orden y el pago en escrow.
- [ ] `resolve` con rol BUSINESS → `FORBIDDEN` 403 sin revelar si la disputa existe.
- [ ] El badge del sidebar (F5-01) y `openCount` usan el mismo criterio de "abierta".
- [ ] La paginación no repite ni salta filas aunque varias compartan fecha/urgencia.
- [ ] `getById` expone la trazabilidad D6 (`recordingComplete`,
      `recordingCompleteAtResolution`, `resolutionNotes`).

## Comandos para Roger (si aplica)

No aplica.
