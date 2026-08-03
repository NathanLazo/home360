# [F5-03] Implementar procedures de lectura de `admin.users` (list, detail, CSV)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §2, `spec/00-foundations.md` §3 (User, Business, Worker, Dispute, Order)
- **Depende de**: `F5-01`, `F0-12` (`BusinessDocument`)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Capa de datos de W10: listado por tabs (negocios/clientes/trabajadores) con búsqueda,
filtro de estado y paginación por cursor; detalle completo de negocio; export CSV.

**Problemas detectados y resolución**:

1. "En disputa" es un estado **derivado** (no existe en `BusinessStatus`). **Resolución**:
   se computa en la query (`disputes.some({ status: { not: RESOLVED } })`) y se expone como
   `derivedStatus`. Precedencia del badge: `PENDING`/`SUSPENDED`/`REJECTED` ganan;
   solo un negocio `ACTIVE` con disputa abierta muestra "En disputa".
2. `getBusinessDetail` promete documentos. D5 ya resolvió el hueco: `F0-12` crea
   `BusinessDocument`. **Resolución**: el detalle consulta documentos con `select` mínimo;
   no deja un empty-state permanente ni duplica su modelo en F5.
3. CSV: el copy visible se traduce, pero un CSV es un artefacto de datos generado en
   servidor. **Resolución**: headers del CSV en inglés estable (`id,name,type,...`),
   documentado como formato de exportación, no copy de UI.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/users.ts` — `list`, `getBusinessDetail`, `exportCsv`
  (mutations en F5-05/F5-06); montar `users` en `src/server/api/routers/admin/index.ts`.
- `src/app/[locale]/admin/users/_components/users.schema.ts` — schemas Zod de input
  (compartidos router/UI) y códigos de error del módulo.
- `src/app/[locale]/admin/users/_components/users.types.ts` — tipos inferidos.
- `src/server/services/admin/build-users-csv.ts` — generación CSV pura (testeable).

Fuera de alcance: componentes UI (F5-04), mutations (F5-05/06).

## Detalle técnico

Schemas (`users.schema.ts`):

```ts
export const usersTabSchema = z.enum(["businesses", "customers", "workers"]);
export const businessDerivedStatusSchema =
  z.enum(["active", "pending", "suspended", "rejected", "in_dispute"]);
export const listUsersSchema = z.object({
  tab: usersTabSchema,
  search: z.string().trim().max(100).optional(),
  status: businessDerivedStatusSchema.optional(),  // solo aplica al tab businesses
  cursor: z.string().cuid().optional(),
}).strict();
```

`list` (`adminProcedure.query`) — result:

```ts
type ListUsersResult =
  | { tab: "businesses"; counts: UserCounts; nextCursor: string | null;
      items: BusinessRow[] }
  | { tab: "customers"; counts: UserCounts; nextCursor: string | null;
      items: CustomerRow[] }
  | { tab: "workers"; counts: UserCounts; nextCursor: string | null;
      items: WorkerRow[] };
// take 20 + 1 para derivar nextCursor; no devuelve arrays de tabs no solicitados.
```

- `search` filtra `name`/`email` (`contains`, `mode: "insensitive"`); en workers filtra
  `fullName` y `business.name`.
- `derivedStatus`: mapear `Business.status` (`REJECTED` existe tras F5-05; hasta entonces
  el enum Zod ya lo contempla y el mapeo lo trata como rama futura) y sobreescribir con
  `in_dispute` si `status === ACTIVE` y `_count` de disputas no resueltas > 0. El filtro
  `status: "in_dispute"` se traduce a `status ACTIVE AND disputes.some(status != RESOLVED)`.
- `ordersCount` vía `_count`.

`getBusinessDetail` (`{ businessId: z.string().cuid() }`) — result:

```ts
{
  id; name; type; status; statusReason: string | null; derivedStatus;
  guaranteeType; guaranteeNotes;
  ownerName: string | null; ownerEmail: string | null; createdAt;
  stripeAccountId: string | null;                 // para mostrar estado Connect
  subscription: { planCode: string; status: SubscriptionStatus; renewsAt: Date } | null;
  ordersCount: number;
  recentOrders: { id; folio; title; amountCents; status; createdAt }[];   // take 10 desc
  disputes: { openCount: number;
              items: { id; title; status; urgency; createdAt }[] };       // take 5 desc
  documents: Array<{
    id: string; type: DocumentType; status: DocumentStatus;
    fileUrl: string; reviewedAt: Date | null; notes: string | null;
  }>;
}
```

Negocio inexistente → `fail("NOT_FOUND", 404, ...)` (el rol ya fue validado por
`adminProcedure`; para un admin sí se revela el 404).

`exportCsv` (`{ tab: usersTabSchema }`) — result
`{ csv: string; filename: string; exportedRows: number; truncated: boolean }`.
`build-users-csv.ts` recibe las filas ya consultadas (mismos `select` que `list`, sin
cursor, cap 5 000 filas) y produce CSV RFC 4180 (comillas escapadas, `\r\n`). Consulta
5 001 filas para informar `truncated: true` sin cargar el dataset completo. `filename`:
`home360-<tab>-<yyyy-MM-dd>.csv`. La descarga es client-side (F5-04).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse` en toda procedure; errores como códigos estables.
- `adminProcedure`; 403 uniforme para roles no admin.
- TypeScript estricto: sin `any`; unión discriminada tipada para las filas por tab.
- Identificadores en inglés; sin copy hardcodeado (las procedures no retornan copy).
- Dinero en centavos.
- Prisma: `select` mínimo, agregaciones con `_count`, sin N+1 (una query por tab + counts
  en `Promise.all` dentro de la misma procedure).

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Con el seed: tab businesses lista Plomería García (ACTIVE o "in_dispute" si tiene
      disputa abierta), Eléctrica Volta (pending), Clima Norte MX (suspended); counts correctos.
- [ ] `status: "in_dispute"` retorna solo negocios ACTIVE con disputa no resuelta.
- [ ] `getBusinessDetail` de Plomería García incluye órdenes recientes y disputas del seed.
- [ ] `getBusinessDetail` incluye documentos reales de `BusinessDocument` y solo expone
      los campos necesarios.
- [ ] `exportCsv` produce CSV parseable, informa el truncamiento y nunca supera 5 000 filas.
- [ ] Éxito y fallo respetan `{ result, error, status, message }`; ningún branch retorna
      datos desnudos.

## Comandos para Roger (si aplica)

No aplica.
