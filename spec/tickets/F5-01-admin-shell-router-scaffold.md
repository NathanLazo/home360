# [F5-01] Crear shell del panel admin: layout oscuro, guard de rol y namespace `admin`

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` (intro), `spec/00-foundations.md` §5 (adminProcedure), §7 (app-sidebar)
- **Depende de**: `F0-04`, `F0-05`, `F0-08`, `F0-09`, `F0-12`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Todo F5 vive bajo `/admin` con `AppSidebar variant="dark"` y bajo el namespace tRPC
`admin.*` con `adminProcedure`. Este ticket crea el esqueleto: layout con verificación de
rol en servidor, sidebar oscuro con badge de disputas abiertas, y la estructura de routers
`admin` en `root.ts` para que los tickets siguientes solo agreguen sub-routers.

**Problema detectado**: la spec pide un badge con conteo de disputas abiertas en el
sidebar, pero ninguna procedure de la spec expone ese conteo de forma ligera (el router
`admin.disputes` llega en F5-08). **Resolución**: este ticket agrega la procedure
`admin.overview.getSidebarStats` (extensión mínima de la spec) que retorna
`{ openDisputes: number }`; el layout (server component) la consume vía el caller de
servidor de tRPC — los componentes jamás tocan Prisma.

## Alcance

Crear/modificar:

- `src/server/api/routers/admin/index.ts` — `adminRouter = createTRPCRouter({ overview })`
  (los tickets F5-03/08/10/13 agregan `users`, `disputes`, `finance`, `settings`).
- `src/server/api/routers/admin/overview.ts` — solo `getSidebarStats` (el resto en F5-02).
- `src/server/api/root.ts` — montar `admin: adminRouter`.
- `src/app/[locale]/admin/layout.tsx` — reemplazar/completar el layout estático de F0.
- `src/app/[locale]/admin/page.tsx` — placeholder mínimo si no existe (W9 real en F5-02).
- `src/messages/es/admin.json` · `src/messages/en/admin.json` — claves de navegación.

Fuera de alcance: contenido de W9–W13, cualquier otra procedure.

## Detalle técnico

- **Layout** (`admin/layout.tsx`, server component):
  1. `const session = await auth()`; sin sesión → `redirect("/login")` (respetando locale).
  2. `session.user.role !== "ADMIN"` → `redirect("/dashboard")` (no revela nada del admin).
  3. Obtiene `getSidebarStats` con el caller de servidor (`api.admin.overview.getSidebarStats()`).
  4. Renderiza `AppSidebar variant="dark"` (fondo `#18181b`, texto claro — tokens ya
     definidos en F0) con items: Resumen `/admin`, Usuarios `/admin/users`, Disputas
     `/admin/disputes` (badge `openDisputes` si > 0), Finanzas `/admin/finance`,
     Configuración `/admin/settings`; `sidebar-user-card` con el usuario de sesión y
     `LocaleSwitcher`.
- **Procedure**:

  ```ts
  // admin.overview.getSidebarStats — adminProcedure.query
  // Result: TrpcResponse<{ openDisputes: number }>
  // openDisputes = count(Dispute where status in [OPEN, IN_REVIEW])
  // éxito = { result: { openDisputes }, error: null, status: 200, message }
  ```
- El layout desempaqueta el contrato antes de usarlo. Si la query falla, el sidebar sigue
  siendo navegable y omite el badge; registra el código estable en servidor sin exponer
  detalles. No accede a Prisma desde el componente.

- Navegación i18n: claves `admin.nav.overview|users|disputes|finance|settings` en es/en.
- El guard de rol de las procedures ya existe (`adminProcedure`, F0): rol incorrecto →
  `FORBIDDEN` 403 uniforme sin revelar existencia de recursos. Este ticket no lo
  re-implementa, solo lo consume.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- TODO el namespace `admin` con `adminProcedure`; 403 uniforme sin revelar recursos.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Componentización máxima; el layout compone piezas existentes de `src/components/`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Login como admin del seed → `/admin` renderiza sidebar oscuro con los 5 items y
      badge con el nº de disputas abiertas del seed.
- [ ] Login como BUSINESS/CUSTOMER → `/admin` redirige fuera; llamar `admin.overview.*`
      por API retorna `FORBIDDEN` 403.
- [ ] El sidebar alterna es/en con `LocaleSwitcher` sin romper la ruta activa.

## Comandos para Roger (si aplica)

No aplica.
