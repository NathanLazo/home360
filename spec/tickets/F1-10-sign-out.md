# [F1-10] Cerrar sesión (menú de usuario en dashboard y admin)

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: hueco detectado en `F1-findings.md` B1 (ninguna pantalla lo especificaba)
- **Depende de**: `F1-03` (NextAuth), `F1-06` (layouts ya cargan usuario)
- **Tamaño estimado**: S (< 1 h)

## Contexto

Ninguna de las 13 pantallas del diseño web muestra cómo se cierra sesión, aunque la app móvil
sí tiene "Cerrar sesión" en el perfil (N7 y T4). Es un hueco del diseño, no una decisión de
producto: una sesión que no se puede cerrar es un problema de seguridad en cualquier equipo
compartido.

Se resuelve con el patrón estándar de estos dashboards: avatar en el header que abre un
`DropdownMenu` con los datos de la cuenta y la acción de salir.

## Alcance

Crear:

- `src/components/user-menu.tsx` (compartido: lo usan dashboard y admin)
- `src/components/sign-out-item.tsx` (`"use client"`, aísla la única parte interactiva)

Modificar:

- `src/app/[locale]/dashboard/_components/dashboard-header.tsx`
- `src/app/[locale]/admin/_components/admin-header.tsx`
- `src/app/[locale]/dashboard/layout.tsx` y `src/app/[locale]/admin/layout.tsx` (solo
  cablear el usuario ya obtenido por `requireRole` hacia el header, si aún no lo hacen)
- `src/messages/{es,en}/common.json`

Fuera de alcance: página de perfil, cambio de contraseña (F6-10), preferencias.

## Detalle técnico

- `user-menu.tsx` es Server Component: recibe `{ name, email, role }` ya resueltos por el
  layout (que ya carga la sesión), y renderiza `Avatar` con iniciales + `DropdownMenu`.
  No vuelve a llamar `auth()`: el layout ya lo hizo.
- Contenido del menú: nombre y correo (correo con `truncate` y `title`), separador, y
  `SignOutItem`.
- `sign-out-item.tsx` es el único cliente: con `next-auth@5.0.0-beta.25` usa
  `signOut({ redirectTo })` de `next-auth/react`,
  con estado `pending` que deshabilita el ítem para evitar el doble clic.
- **El destino conserva el locale activo**: obtenerlo con el helper `getPathname` creado por
  `createNavigation(routing)`, no concatenar `/${locale}` (en español con
  `localePrefix: "as-needed"` el path canónico es `/login`, no `/es/login`). Cerrar sesión y
  aterrizar en el idioma equivocado es el clásico detalle que delata una app mal
  internacionalizada.
- Variante visual según el layout: el menú hereda la paleta del header (claro en dashboard,
  oscuro en admin) vía la prop `variant` que ya usa `AppSidebar`.
- Accesibilidad: el disparador es un `button` con `aria-label` traducido; el menú se navega
  con teclado y cierra con `Esc` (lo da Radix, pero se verifica).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure (este ticket no añade ninguna).
- TypeScript estricto: sin `any`; la forma de la sesión se infiere de la augmentation de F1-03.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Componentización máxima: la parte cliente se aísla en su propio archivo.
- Server Components por defecto.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] El menú aparece en el header de `/dashboard` y de `/admin`, con las iniciales correctas.
- [ ] Cerrar sesión redirige a `/login` **en el locale activo** y la sesión queda invalidada
      (volver atrás no reabre el dashboard).
- [ ] Español termina en `/login`; inglés en `/en/login`, sin doble prefijo.
- [ ] Navegable por teclado, con foco visible y cierre con `Esc`.
- [ ] Ningún string hardcodeado; ambos locales completos.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
