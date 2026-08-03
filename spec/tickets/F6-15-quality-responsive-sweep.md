# [F6-15] Auditar responsive en todas las rutas

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §3 (Responsive); `spec/00-foundations.md`
  §7 (`app-sidebar`); `spec/05-admin.md` (master-detail de disputas)
- **Depende de**: `F6-14` (serializa barridos sobre los mismos archivos)
- **Tamaño estimado**: M

## Contexto

Dimensión **responsive** del checklist: sidebar colapsa a Sheet en < 1024 px, tablas con
scroll horizontal contenido, master-detail de disputas apilado en móvil, y la landing
usable en móvil. Pase de auditoría + fixes; si F0 ya implementó el colapso del sidebar,
aquí solo se verifica.

## Alcance

- `src/components/app-sidebar.tsx` (+ trigger móvil en los layouts de dashboard/admin si
  falta).
- `src/components/data-table.tsx` (wrapper de scroll).
- `_components/` de módulos solo para fixes de layout responsive (grids, master-detail
  de disputas, filtros que desbordan).
- Landing `(public)/_components/` (grids ya previstos en F6-04…06 — verificación).

Fuera de alcance: rediseños; a11y (F6-13); estados (F6-12).

## Detalle técnico

Breakpoints de referencia: 375 px (móvil), 768 px (tablet), 1024 px (desktop), 1440 px.

1. **Sidebar** (< 1024 px): oculto; botón hamburguesa en el header del layout abre un
   `Sheet` lateral con el mismo contenido (`AppSidebar` reutilizado dentro del Sheet —
   misma variante light/dark). Cierra al navegar. Aplica a dashboard y admin.
2. **Tablas**: `DataTable` envuelta en contenedor `overflow-x-auto` con ancho mínimo por
   tabla; el scroll vive en el contenedor de la tabla, **nunca** en el body (sin scroll
   horizontal de página en ninguna pantalla).
3. **Disputas W11**: master-detail (lista + detalle) apila en < 1024 px — la lista ocupa
   todo el ancho y al seleccionar una disputa el detalle se muestra (vista apilada o
   navegación interna según lo que F5 haya construido; el criterio es: ambas piezas
   usables en 375 px).
4. **Headers de módulo**: `PageHeader` con acciones que envuelven (`flex-wrap`);
   `search-filter-bar` apila filtros en móvil.
5. **Grids**: KPIs 4→2→1 columnas; cards de sucursales y planes 3→1; landing: hero
   apilado, bento 3→1, pricing 3→1 y anclas disponibles en el Sheet móvil (F6-03).
6. **Dialogs/Sheets**: dentro del viewport en 375 px (sin inputs cortados); Sheets a
   ancho completo en móvil.
7. Verificación manual en los 4 anchos para todas las rutas públicas, dashboard y admin,
   en es y en (los textos cambian longitudes).

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

- [ ] Sidebar → Sheet en < 1024 px en dashboard y admin, operable con teclado.
- [ ] Ninguna pantalla produce scroll horizontal del body en 375 px.
- [ ] Disputas usable en móvil (lista y detalle); tablas con scroll contenido.
- [ ] Landing conserva las cuatro anclas en móvil mediante Sheet, sin introducir marca
      en sidebar dashboard/admin.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
