# [F1-05] Componer middleware next-intl + auth con protección de `/dashboard` y `/admin`

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §3 · `spec/00-foundations.md` §6 (routing next-intl)
- **Depende de**: `F1-03` (edge-config); F0 completada (`src/i18n/routing.ts` con `localePrefix: "as-needed"`)
- **Tamaño estimado**: M

## Contexto

Un solo `src/middleware.ts` que resuelve locale (next-intl) y protege rutas por sesión y
rol. Es **cortesía de UX**: la seguridad real vive en procedures (F0 §5) y layouts (F1-06).

**Problemas detectados en la spec y resolución**:

1. "Con `auth()` (NextAuth edge-safe)": la config completa no es edge-safe (Prisma +
   bcrypt). Resolución: el middleware instancia NextAuth con `edgeAuthConfig` (F1-03),
   que solo decodifica el JWT — cero BD en Edge.
2. Con `localePrefix: "as-needed"`, la ruta protegida puede llegar como `/dashboard` o
   `/en/dashboard`. La spec no lo menciona. Resolución: helper que separa el prefijo de
   locale antes de evaluar la ruta, y que lo re-antepone en cada redirect para no perder
   el idioma.
3. Orden de composición no especificado. Resolución: se evalúa auth primero sobre el
   pathname sin locale (redirects tempranos) y, si no hay redirect, se delega en el
   middleware de next-intl para detección/rewrite de locale.

## Alcance

Crear:

- `src/middleware.ts`
- `src/i18n/locale-pathname.ts` (helper `splitLocaleFromPathname`)
- `src/lib/auth/role-home.ts` (helper `homeForRole`, reutilizado por F1-06 y F1-07)

Fuera de alcance: guardas de layout (F1-06), UI de login (F1-07).

## Detalle técnico

### `src/lib/auth/role-home.ts`

Única fuente de verdad del redirect por rol (spec §3, diseño W2):

```ts
import { UserRole } from "../../../generated/prisma";

export const homeForRole = (role: UserRole): "/admin" | "/dashboard" | "/" => {
  if (role === UserRole.ADMIN) return "/admin";
  if (role === UserRole.BUSINESS) return "/dashboard";
  return "/"; // CUSTOMER y WORKER usan la app móvil
};

export const isRouteOrDescendant = (pathname: string, root: string): boolean =>
  pathname === root || pathname.startsWith(`${root}/`);
```

Archivo puro (sin imports de servidor): importable desde middleware (edge), layouts y
componentes cliente. F1-07 añade en este mismo archivo `safeCallbackForRole`: recibe
`unknown`, solo acepta paths internos sin `\`, caracteres de control ni origen externo, y
solo devuelve `/admin[/…]` para ADMIN o `/dashboard[/…]` para BUSINESS. CUSTOMER/WORKER no
aceptan callback web protegido. Esta única regla evita redirects abiertos y escalamiento de
ruta entre roles.

### `src/i18n/locale-pathname.ts`

`splitLocaleFromPathname(pathname: string): { locale: Locale | null; pathname: string }`
usando `routing.locales`; con `as-needed` el prefijo `es` normalmente no aparece.
`localePrefix(locale, path)` re-antepone el prefijo solo si venía en la URL.

### `src/middleware.ts`

```ts
import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "~/i18n/routing";
import { edgeAuthConfig } from "~/server/auth/edge-config";

const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  const { locale, pathname } = splitLocaleFromPathname(req.nextUrl.pathname);
  const session = req.auth;
  const wantsDashboard = isRouteOrDescendant(pathname, "/dashboard");
  const wantsAdmin = isRouteOrDescendant(pathname, "/admin");

  if ((wantsDashboard || wantsAdmin) && !session) {
    const loginUrl = new URL(withLocalePrefix(locale, "/login"), req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  if (session && (wantsDashboard || wantsAdmin)) {
    const home = homeForRole(session.user.role);
    const allowed = (wantsDashboard && home === "/dashboard") || (wantsAdmin && home === "/admin");
    if (!allowed) return NextResponse.redirect(new URL(withLocalePrefix(locale, home), req.nextUrl));
  }
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- `callbackUrl` guarda un pathname interno **sin prefijo de locale**; el router i18n de
  F1-07 vuelve a aplicar el locale activo. Nunca interpolar manualmente el query string:
  usar `URL.searchParams` evita doble encoding.
- La comprobación usa límite de segmento: `/dashboard` y `/dashboard/services` están
  protegidos, pero `/dashboard-public` y `/administrator` no coinciden accidentalmente.
- El matcher excluye `api` (NextAuth y tRPC), `_next`, `_vercel` y archivos estáticos
  (spec §3).
- `req.auth` tipa `Session | null`; `session.user.role` viene de la augmentation de F1-03.
- Prohibido importar Prisma, `~/server/db` o `~/server/auth/config` (solo `edge-config`).

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

- [ ] Sin sesión, `GET /dashboard` y `GET /admin` redirigen a `/login?callbackUrl=…`; `GET /en/dashboard` redirige a `/en/login?...`.
- [ ] Con sesión BUSINESS, `/admin` redirige a `/dashboard`; con ADMIN, `/dashboard` redirige a `/admin`; con CUSTOMER, ambas redirigen a `/`.
- [ ] `/` y `/en` siguen resolviendo locale correctamente (next-intl intacto).
- [ ] `/api/auth/*` y `/api/trpc/*` no pasan por el middleware (matcher).
- [ ] `/dashboard-public` y `/administrator` no se clasifican como rutas protegidas por
      coincidencia parcial.
- [ ] `pnpm dev` arranca sin errores de Edge runtime (sin Prisma/bcrypt en el bundle del middleware); `pnpm typecheck` + `pnpm check` en verde.
- [ ] `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
