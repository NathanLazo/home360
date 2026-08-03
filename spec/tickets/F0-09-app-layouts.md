# [F0-09] Crear layouts base de dashboard (claro) y admin (oscuro)

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §7 (layouts de módulo); `spec/02` §0 y `spec/05` (encabezado) como referencia de lo que asumirán
- **Depende de**: `F0-07`, `F0-08`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Crea `[locale]/dashboard/layout.tsx` (sidebar claro + header) y
`[locale]/admin/layout.tsx` (sidebar oscuro `#18181b`) **con datos estáticos** — F1
agrega la verificación de sesión/rol y F2/F5 los conectan a datos reales. En F0 estas
rutas son navegables sin auth (aceptado: no exponen datos; la protección llega en F1 y
es criterio de F1, no de F0).

**Hueco detectado**: la spec no dice qué páginas viven bajo estos layouts en F0 (sin una
`page.tsx` el layout no es visitable). **Resolución**: crear `dashboard/page.tsx` y
`admin/page.tsx` placeholder (título + `EmptyState`), que F2/F5 reemplazarán.

## Alcance

Crear:

- `src/app/[locale]/dashboard/layout.tsx`
- `src/app/[locale]/dashboard/page.tsx` (placeholder)
- `src/app/[locale]/dashboard/_components/dashboard-nav.ts` (items estáticos del sidebar)
- `src/app/[locale]/admin/layout.tsx`
- `src/app/[locale]/admin/page.tsx` (placeholder)
- `src/app/[locale]/admin/_components/admin-nav.ts` (items estáticos)

Modificar:

- `src/messages/es/dashboard.json`, `src/messages/en/dashboard.json`
- `src/messages/es/admin.json`, `src/messages/en/admin.json`

Solo se agregan labels de navegación y títulos/copy de los placeholders.

Fuera de alcance: `BranchSelector` (F2), badge con conteos reales, auth/redirects (F1).

## Detalle técnico

- `dashboard-nav.ts` / `admin-nav.ts`: arrays de un tipo local exportado
  `SidebarNavDefinition = Omit<SidebarItem, "label"> & { labelKey: string }`. No declararlos
  como `SidebarItem[]`, porque ese tipo exige el `label` ya traducido. El layout resuelve
  cada `labelKey` con `getTranslations` y mapea el resultado a `SidebarItem[]` antes de
  pasarlo a `AppSidebar`. Rutas del diseño:
  - Dashboard: `/dashboard`, `/dashboard/services`, `/dashboard/products`,
    `/dashboard/payments`, `/dashboard/subscription`, `/dashboard/branches` (+ órdenes
    `/dashboard/orders`; team/settings los agrega F6). Íconos lucide razonables
    (Home, Wrench, Package, CreditCard, BadgeDollarSign/Receipt, MapPin, ClipboardList).
  - Admin: `/admin`, `/admin/users`, `/admin/disputes`, `/admin/finance`,
    `/admin/settings` (LayoutDashboard, Users, ScaleIcon/Gavel, Banknote, Settings).
- `dashboard/layout.tsx` (Server Component): grid `sidebar | contenido`; header superior
  con espacio reservado para `BranchSelector` (comentario TODO F2) y `LocaleSwitcher`
  real. `AppSidebar variant="light"` con usuario estático
  (`{ name: "—", initials: "PG" }` vía claves placeholder) y `badgeCount` estático en
  órdenes (p. ej. 3) para validar el estilo.
- `admin/layout.tsx`: igual con `variant="dark"`, badge estático en disputas.
- Responsive mínimo: en `< lg` el sidebar se oculta (`hidden lg:flex`); el colapso a
  Sheet es parte del pulido F6 — dejar comentario.
- Páginas placeholder: `PageHeader` + `EmptyState` con claves
  `dashboard.placeholder.*` / `admin.placeholder.*` en ambos locales.

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

- [ ] `/dashboard` y `/admin` (y `/en/...`) renderizan sidebar + header + placeholder.
- [ ] Sidebar claro y oscuro fieles a los tokens (blanco/borde zinc vs `#18181b`); tipografía Geist; item activo resaltado.
- [ ] `LocaleSwitcher` funcional en ambos layouts.
- [ ] Labels de nav 100 % desde `dashboard.json`/`admin.json` es/en (claves idénticas en ambos locales).
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno).
