# [F1-06] Añadir guardas de sesión y rol en los layouts de `/dashboard` y `/admin`

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §3 (párrafo "la seguridad real vive en… los layouts de servidor")
- **Depende de**: `F1-03` (sesión con role), `F1-05` (`homeForRole`); F0 completada (layouts base de dashboard/admin)
- **Tamaño estimado**: S

## Contexto

El middleware (F1-05) es cortesía de UX; los layouts de servidor son la barrera real en
render: verifican sesión + rol con `auth()` y hacen `redirect()`. F0 dejó
`[locale]/dashboard/layout.tsx` y `[locale]/admin/layout.tsx` renderizando con datos
estáticos; este ticket les añade la guarda sin tocar su estructura visual.

**Hueco detectado**: la spec no define cómo hacer el `redirect()` respetando el locale.
Resolución: usar el `redirect` de `src/i18n/navigation.ts` (wrapper de next-intl sobre
`next/navigation`), que antepone el locale activo. Si F0 no creó `navigation.ts`
(la spec F0 §6 solo lista `routing.ts` y `request.ts`), este ticket lo crea con
`createNavigation(routing)`.

## Alcance

Crear (solo si no existe):

- `src/i18n/navigation.ts`
  (`export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)`)
- `src/server/auth/require-role.ts`

Modificar:

- `src/app/[locale]/dashboard/layout.tsx`
- `src/app/[locale]/admin/layout.tsx`

Fuera de alcance: cambios visuales de los layouts, botón de sign-out (ver
`spec/tickets/F1-findings.md`), middleware.

## Detalle técnico

### `src/server/auth/require-role.ts`

Helper de servidor reutilizable (un archivo = una responsabilidad):

```ts
import { UserRole } from "../../../generated/prisma";
import { type Session } from "next-auth";
import { auth } from "~/server/auth";
import { redirect } from "~/i18n/navigation";
import { homeForRole } from "~/lib/auth/role-home";

export const requireRole = async (
  allowedRole: UserRole,
  locale: string,
  callbackPath: string,
): Promise<Session["user"]> => {
  const session = await auth();
  if (!session) {
    redirect({ href: `/login?callbackUrl=${encodeURIComponent(callbackPath)}`, locale });
  }
  if (session.user.role !== allowedRole) {
    redirect({ href: homeForRole(session.user.role), locale });
  }
  return session.user;
};
```

`redirect` de next-intl lanza, así que el narrowing posterior es válido. Usar la firma
tipada que exporte `createNavigation(routing)`; no envolverla con casts ni llamar al
`redirect` crudo de `next/navigation`.

### Layouts

En cada layout (Server Component, async, con `params: Promise<{ locale: string }>` en
Next 15):

- `dashboard/layout.tsx`: `const user = await requireRole(UserRole.BUSINESS, locale, "/dashboard");`
- `admin/layout.tsx`: `const user = await requireRole(UserRole.ADMIN, locale, "/admin");`

El `user` devuelto puede pasarse al sidebar (nombre/rol) si el layout de F0 ya lo pinta;
no ampliar más el alcance.

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

- [ ] La revisión del layout confirma que `requireRole` se ejecuta antes de renderizar datos
      o children; no se requiere desactivar ni editar temporalmente el middleware.
- [ ] ADMIN que entra a `/dashboard` acaba en `/admin` y viceversa; CUSTOMER acaba en `/`.
- [ ] Los redirects conservan el locale (`/en/dashboard` → `/en/login?...`).
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
