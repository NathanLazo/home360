# [F0-08] Construir los componentes compartidos del sistema de diseño

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §7 (lista de `src/components/`)
- **Depende de**: `F0-06`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Crea las piezas de reuso real entre módulos (sidebar, KPI card, tabla tipada, badges,
etc.) que F2–F5 consumen tal cual. Son componentes **presentacionales**: reciben datos y
callbacks por props, no llaman tRPC ni traducen por sí mismos (reciben strings ya
traducidos o claves explícitas vía props), para poder usarse desde cualquier módulo sin
acoplarse a un namespace i18n.

**Hueco detectado**: la spec no define las props de cada componente. **Resolución**: se
fijan aquí las firmas mínimas (abajo); los módulos futuros pueden extenderlas de forma
retrocompatible.

## Alcance

Crear en `src/components/`:

- `app-sidebar.tsx`, `sidebar-nav-item.tsx`, `sidebar-user-card.tsx`
- `kpi-card.tsx`
- `data-table.tsx`
- `status-badge.tsx`
- `search-filter-bar.tsx`
- `page-header.tsx`
- `empty-state.tsx`
- `confirm-dialog.tsx`

Modificar solo si `lucide-react` no quedó como dependencia directa en F0-06:

- `package.json`
- `pnpm-lock.yaml`

Fuera de alcance: `locale-switcher.tsx` (F0-07), `branch-selector.tsx` (F2), montaje en
layouts (F0-09), datos reales.

## Detalle técnico

Firmas mínimas (todas exportan el tipo de sus props):

- `AppSidebar`: `{ variant: "light" | "dark"; items: SidebarItem[]; user: { name: string; subtitle?: string; initials: string }; footerSlot?: ReactNode }`
  con `type SidebarItem = { key: string; label: string; href: string; icon: LucideIcon; badgeCount?: number }`.
  Variante `light`: fondo blanco, borde zinc; `dark`: fondo `#18181b`, texto claro
  (clases condicionales, no dos componentes). Marca item activo comparando con
  `usePathname()` de `~/i18n/navigation` (única parte client; extraer a
  `sidebar-nav-item.tsx` con `"use client"` y dejar `app-sidebar.tsx` server-compatible).
- `SidebarNavItem`: item individual con icono lucide, label y `Badge` opcional de conteo.
- `SidebarUserCard`: `Avatar` con iniciales + nombre + subtítulo.
- `KpiCard`: `{ label: string; value: string; delta?: { text: string; trend: "up" | "down" | "neutral" }; icon?: LucideIcon }` — el valor llega ya formateado (el formateo de moneda vive en el módulo que la usa).
- `DataTable<TData>`: genérico con columnas declarativas
  `{ columns: Array<{ key: string; header: ReactNode; cell: (row: TData) => ReactNode; className?: string }>; data: TData[]; emptyState?: ReactNode; onRowClick?: (row: TData) => void }`
  sobre los componentes `Table` de shadcn. Sin paginación interna (los módulos usan
  cursor + su propio control).
- `StatusBadge<TStatus extends string>`: `{ status: TStatus; variantMap: Record<TStatus, "success" | "warning" | "info" | "muted" | "destructive">; label: string }` —
  el mapa de color por estado lo declara cada módulo; aquí solo la paleta unificada
  (verde/ámbar/azul/gris/rojo sobre `Badge`).
- `SearchFilterBar`: `{ searchValue: string; onSearchChange: (v: string) => void; searchPlaceholder: string; children?: ReactNode }` — los `Select` de filtro entran como children.
- `PageHeader`: `{ title: string; subtitle?: string; actions?: ReactNode }`.
- `EmptyState`: `{ icon?: LucideIcon; title: string; description?: string; action?: ReactNode }`.
- `ConfirmDialog`: wrapper de `AlertDialog`:
  `{ open, onOpenChange, title, description, confirmLabel, cancelLabel, destructive?, onConfirm, loading? }`.

Reglas: `lucide-react` llega como dependencia transitiva de shadcn — si no quedó en
`package.json`, agregarla explícita. Montos/folios que se rendericen mono usan la clase
`font-mono` (Geist Mono, F0-06). Cero texto hardcodeado: todo string visible entra por
props.

Smoke-check visual: montar temporalmente los componentes en la página placeholder NO está
permitido como entrega; verificación visual llega en F0-09 (layouts con datos estáticos).
Aquí basta con que `pnpm typecheck` y `pnpm build` pasen: la build compila cada componente
y detecta imports rotos o props mal tipadas.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] Los 10 archivos existen, un componente por archivo, props exportadas y tipadas.
- [ ] `DataTable` y `StatusBadge` son genéricos sin `any` ni casts.
- [ ] Ningún string visible hardcodeado dentro de los componentes.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno).
