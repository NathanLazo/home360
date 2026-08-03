# [F5-02] Implementar W9 — Resumen de plataforma `/admin`

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §1, `spec/00-foundations.md` §3 (Payment, Business, Dispute, PlatformSettings)
- **Depende de**: `F5-01`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Pantalla de aterrizaje del admin: KPIs de plataforma, negocios pendientes de aprobación,
disputas abiertas y resumen de configuración IA.

**Problemas detectados y resolución**:

1. La spec define GMV = "Σ pagos del mes (todos los estados cobrados)" sin listar estados.
   **Resolución**: cobrado = `Payment.status != PENDING` (incluye `IN_ESCROW`, `RELEASED`,
   `REFUNDED`, `PARTIALLY_REFUNDED`); mes = `createdAt` dentro del mes calendario actual.
   `gmvDeltaPct` compara contra el mes anterior; si el mes anterior es 0 → `null`
   (la UI muestra "—").
2. Las "acciones rápidas Aprobar/Revisar" de `pending-businesses-table` viven en W9 pero
   la mutation de aprobación pertenece al módulo de W10 y nada se importa entre
   `_components` de módulos distintos. **Resolución**: ambas acciones navegan a
   `/admin/users?business=<id>` (deep-link que abre el sheet de detalle, ver F5-04);
   la aprobación real ocurre en W10.
3. "Usuarios" representa usuarios externos de la plataforma, no cuentas internas.
   **Resolución**: `totalUsers` y `newUsersMonth` excluyen `User.role = ADMIN`; incluyen
   CUSTOMER, BUSINESS y WORKER con el mismo filtro en ambos periodos.
4. `PlatformSettings.updatedAt` corresponde al singleton completo, no solo a IA. La card
   usa el copy "Configuración actualizada", sin atribuir la fecha exclusivamente a IA.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/overview.ts` — agregar `getKpis`, `getPendingBusinesses`,
  `getOpenDisputes`, `getAiConfigSummary` (junto a `getSidebarStats` de F5-01).
- `src/app/[locale]/admin/page.tsx` · `loading.tsx` · `error.tsx`.
- `src/app/[locale]/admin/_components/`:
  `overview-view.tsx`, `kpi-row.tsx`, `pending-businesses-table.tsx`,
  `open-disputes-list.tsx`, `ai-config-card.tsx`, `overview.types.ts`.
- `src/messages/{es,en}/admin.json` — sección `overview`.

Fuera de alcance: mutations (aprobar vive en F5-05), routers users/disputes/finance/settings.

## Detalle técnico

Procedures (`adminProcedure.query`, todas `TrpcResponse<...>`):

```ts
getKpis: {
  totalUsers: number;            // count User where role != ADMIN
  newUsersMonth: number;         // mismo filtro, createdAt en mes actual
  activeBusinesses: number;      // Business.status = ACTIVE
  pendingBusinesses: number;     // Business.status = PENDING
  gmvCents: number;              // Σ Payment.amountCents (status != PENDING, mes actual)
  gmvDeltaPct: number | null;    // vs. mes anterior; null si base 0
  escrowCents: number;           // Σ Payment.amountCents (IN_ESCROW)
  escrowOrders: number;          // count Payment IN_ESCROW
}
getPendingBusinesses: Array<{ id; name; type: BusinessType; guaranteeType: GuaranteeType }>
  // status PENDING, orderBy createdAt asc, take 5
getOpenDisputes: Array<{
  id; title; urgency: DisputeUrgency; status: DisputeStatus;
  businessName: string; customerName: string;   // partes: business.name + order.customer.name
  escrowCents: number;                          // order.payment.amountCents (0 si sin pago)
  createdAt: Date;
}> // status in [OPEN, IN_REVIEW], orderBy [urgency desc, createdAt asc], take 3
getAiConfigSummary: {
  confidenceThresholdPct: number;   // PlatformSettings.aiConfidenceThresholdPct
  pricingModel: string;             // aiPricingModel
  updatedAt: Date;                  // fecha del singleton completo
} // si el singleton no existe (seed no corrido) → fail("NOT_FOUND", 404, ...)
```

Agregaciones con `db.payment.aggregate`/`groupBy` y `select` mínimo; nada se calcula en
cliente.

UI:

- `kpi-row.tsx`: 4 `KpiCard` (componente compartido F0) — Usuarios totales (sub: +N este
  mes), Negocios activos (sub: N pendientes), GMV del mes (sub: delta %), En escrow
  (sub: N órdenes). Montos con formato MXN vía `useFormatter` (centavos ÷ 100 solo en UI).
- `pending-businesses-table.tsx`: `data-table` con nombre, tipo, garantía
  (`guarantee-badge` llega en F5-04: aquí usar `status-badge`/texto traducido simple) y
  acciones "Aprobar"/"Revisar" → `Link` a `/admin/users?business=<id>`.
- `open-disputes-list.tsx`: 3 items con urgencia (rojo URGENT / ámbar), partes, monto en
  escrow y `Link` a `/admin/disputes?dispute=<id>`.
- `ai-config-card.tsx`: umbral, modelo, "Configuración actualizada <fecha relativa>", `Link` a
  `/admin/settings`.
- `overview-view.tsx` orquesta; `page.tsx` es composición delgada (prefetch con el
  patrón server/hydration ya usado en fases previas).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse` en toda procedure; errores como códigos estables.
- `adminProcedure` en todo el namespace `admin`; 403 uniforme.
- TypeScript estricto: sin `any`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, en `_components/`.
- Prisma con `select` explícito y mínimo.
- Toda procedure retorna exactamente `{ result, error, status, message }`; la UI valida
  `error`/`result` antes de renderizar.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Con el seed: KPIs cuadran a mano contra los datos del seed (GMV, escrow, conteos).
- [ ] "Eléctrica Volta" aparece en pendientes; la disputa URGENT del seed aparece primera.
- [ ] "Aprobar"/"Revisar" navegan a `/admin/users?business=<id>`; disputa → `/admin/disputes?dispute=<id>`.
- [ ] es/en completos; montos en formato MXN.
- [ ] Los KPIs de usuarios excluyen ADMIN tanto en total como en altas del mes.

## Comandos para Roger (si aplica)

No aplica (requiere seed ya ejecutado en F0).
