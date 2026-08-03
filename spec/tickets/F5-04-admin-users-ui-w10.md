# [F5-04] Implementar UI de W10 — Usuarios `/admin/users` (tabs, tablas, detalle)

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §2 (módulo), `spec/00-foundations.md` §7 (data-table, status-badge, search-filter-bar)
- **Depende de**: `F5-03`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Vista de gestión de cuentas: tabs Negocios/Clientes/Trabajadores con counts, búsqueda,
filtro de estado, tablas, sheet de detalle de negocio y export CSV. Las mutations
(aprobar/rechazar/suspender) llegan en F5-05/F5-06; este ticket deja los puntos de
extensión listos.

**Problemas detectados y resolución**:

1. W9 necesita deep-link a un negocio concreto (ver F5-02) y la spec no define el
   mecanismo. **Resolución**: el sheet de detalle se controla con `?business=<id>` en la
   URL (patrón espejo de `?dispute=<id>` de W11): abrir el sheet hace `router.replace`
   agregando el param; cerrarlo lo quita. Id inexistente → sheet con estado de error
   NOT_FOUND traducido.
2. `user-row-actions.tsx` es "DropdownMenu contextual por estado" pero sus acciones
   dependen de tickets posteriores. **Resolución**: en este ticket el dropdown solo
   renderiza "Ver detalle" y "Exportar fila… (no)": las entradas Aprobar/Rechazar
   (F5-05) y Suspender/Reactivar (F5-06) se agregan en sus tickets; el componente
   recibe `derivedStatus` y ya contiene el `switch` de visibilidad por estado con las
   ramas documentadas en TODO tipado (sin `any`).

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/users/page.tsx` · `loading.tsx` · `error.tsx`.
- `src/app/[locale]/admin/users/_components/`:
  `users-view.tsx`, `users-filters.tsx`, `businesses-table.tsx`, `customers-table.tsx`,
  `workers-table.tsx`, `user-row-actions.tsx`, `business-detail-sheet.tsx`,
  `guarantee-badge.tsx`, `use-users-query.ts` (query + estado de tabs/filtros/cursor).
- `src/messages/{es,en}/admin.json` — sección `users` (tabs, columnas, estados,
  garantías, empty states, CSV button).

Fuera de alcance: `approve-business-dialog`, `suspend-business-dialog`,
`use-user-mutations.ts` (F5-05/06).

## Detalle técnico

- `users-view.tsx`: `Tabs` (shadcn) con counts (`Negocios (12)`); el tab activo vive en
  `?tab=` (default `businesses`) para que sobreviva refresh; debajo `users-filters` +
  tabla del tab + botón "Exportar CSV".
- `users-filters.tsx`: `search-filter-bar` compartido (input con debounce 300 ms) +
  `Select` de estado (solo visible en tab businesses) con los 5 valores de
  `businessDerivedStatusSchema` traducidos: Activo, Pendiente, Suspendido, Rechazado,
  En disputa.
- `businesses-table.tsx`: `data-table` — avatar con iniciales (derivadas del nombre en
  UI), nombre + tipo, `guarantee-badge`, fecha de registro (formato relativo next-intl),
  nº órdenes, `status-badge` de `derivedStatus` (Activo verde, Pendiente ámbar,
  En disputa rojo, Suspendido gris, Rechazado gris), `user-row-actions`. Click en fila →
  abre `business-detail-sheet` (set `?business=<id>`).
- `customers-table.tsx` / `workers-table.tsx`: columnas del result F5-03; sin acciones de
  estado (solo "Ver detalle" deshabilitado — el detalle es solo de negocios en esta fase).
- `guarantee-badge.tsx`: mapa `GuaranteeType` → label traducido: Depósito / Verificación /
  Seguro por servicio / Bien registrado / Combinada A+B (`COMBINED`).
- `business-detail-sheet.tsx`: `Sheet` lateral con `admin.users.getBusinessDetail`:
  encabezado (nombre, tipo, badge estado y `statusReason` traducido como motivo cuando
  exista), sección Garantía (`guarantee-badge` + notas),
  sección Documentos con los registros de `BusinessDocument` (tipo, estado, enlace seguro
  al archivo, fecha/notas de revisión; empty-state solo cuando el array está vacío), sección
  Suscripción (plan, renueva), historial de órdenes (mini-tabla folio/título/monto/estado)
  y disputas (lista con link a `/admin/disputes?dispute=<id>`). Footer con slot de acciones
  (los dialogs de F5-05/06 se montan ahí).
- Export CSV: `use-users-query.ts` expone `exportCsv(tab)` que llama la procedure y
  dispara descarga client-side (`Blob` + `URL.createObjectURL` + `a.download = filename`);
  siempre revoca el object URL y, si `truncated`, muestra aviso traducido de límite 5 000.
- Toda query comprueba `response.error` antes de leer `response.result`; los errores de
  transporte de la guarda se normalizan con `toErrorCode`. Nunca se asume que `result`
  está presente.
- Paginación: botón "Cargar más" con `nextCursor` (patrón ya usado en fases previas).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- UI → cliente tRPC → procedure; los componentes jamás tocan Prisma.
- Toda respuesta consumida conserva `{ result, error, status, message }`
  (`TrpcResponse`); la UI valida el envelope antes de leer `result`.
- TypeScript estricto: sin `any`; tipos desde `users.types.ts`.
- Identificadores/rutas en inglés; TODO el copy vía next-intl (es/en), incluidos estados,
  garantías y empty states.
- Dinero en centavos; formateo MXN solo aquí.
- Componentización máxima: un archivo = una responsabilidad, en `_components/`; nada se
  importa desde `_components` de otro módulo.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Los 3 tabs muestran counts y filas del seed; búsqueda y filtro de estado funcionan
      (server-side, no filtrado en cliente).
- [ ] `/admin/users?business=<id de Plomería García>` abre el sheet directo (deep-link
      desde W9); cerrar limpia la URL.
- [ ] "Exportar CSV" descarga archivo con nombre `home360-businesses-<fecha>.csv`.
- [ ] El sheet muestra los documentos reales del negocio; URLs y notas no aparecen en
      listados ni CSV.
- [ ] Estados visibles replican el diseño: Activo, Pendiente, En disputa (derivado),
      Suspendido; es/en completos.

## Comandos para Roger (si aplica)

No aplica.
