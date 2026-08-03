# [F1-07] Construir página `/login` (W2) con redirect por rol y botón Google

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §3 (post-login), §4 (`/login`) · `spec/00-foundations.md` §6 (i18n), §7 (design system)
- **Depende de**: `F1-01` (loginSchema), `F1-03` (providers y sesión con role), `F1-05` (`homeForRole`, formato de `callbackUrl`)
- **Tamaño estimado**: M

## Contexto

Pantalla W2: login único con redirect por rol (`ADMIN → /admin`, `BUSINESS → /dashboard`,
`CUSTOMER/WORKER → /` + aviso "usa la app móvil").

**Problemas detectados en la spec y resolución**:

1. El flujo spec (credentials con `redirect: false` + consultar sesión + navegar) no
   aplica a Google: OAuth es un redirect de página completa y no hay código cliente
   post-login. Resolución: página servidor mínima `/post-login` que lee `auth()` y
   redirige con `homeForRole`; el botón Google usa `redirectTo: "/post-login"`. El flujo
   credentials se mantiene tal cual la spec.
2. `callbackUrl` sin validar = open redirect y también puede enviar un BUSINESS a una ruta
   ADMIN. Resolución: `safeCallbackForRole` valida origen, caracteres y límite de segmento,
   y solo acepta la rama permitida para el rol.
3. El aviso `auth.mobileOnly` debe sobrevivir a la navegación a `/`. Resolución: toast de
   sonner disparado antes de `router.push("/")` — el `<Toaster>` vive en el layout raíz
   (F0 §7) y persiste en navegación cliente.
4. La spec fija colores (`#f4f4f5`, botón negro): usar los tokens del design system de F0
   (`bg-muted`, `bg-primary`…), nunca hex hardcodeado.
5. Un email Credentials usado con Google produce `OAuthAccountNotLinked` por diseño seguro
   (F1-03). Se traduce con copy específico y no se habilita vinculación peligrosa.
6. CUSTOMER/WORKER deben ver `mobileOnly` también por OAuth. `/post-login` renderiza un
   componente cliente mínimo que muestra el toast y reemplaza la ruta por `/`; no se difiere
   este requisito a la landing.

## Alcance

Crear:

- `src/app/[locale]/(public)/login/page.tsx`
- `src/app/[locale]/(public)/login/_components/login-form.tsx`
- `src/app/[locale]/(public)/login/_components/google-sign-in-button.tsx`
- `src/app/[locale]/(public)/login/_components/login.schema.ts` (re-export de `~/schemas/auth/login.schema`)
- `src/app/[locale]/(public)/post-login/page.tsx`
- `src/app/[locale]/(public)/post-login/_components/mobile-only-redirect.tsx`

Modificar:

- `src/lib/auth/role-home.ts` (añadir `safeCallbackForRole`, según F1-05)

- `src/messages/es/auth.json` y `src/messages/en/auth.json` (namespace `login` + `mobileOnly`)

Fuera de alcance: registro (F1-08), implementación de recuperación (F1-09; el enlace ya
apunta a `/forgot-password`), estilos globales.

## Detalle técnico

### `page.tsx` (Server Component)

Composición delgada según diseño W2: fondo `bg-muted` a pantalla completa, `Card` shadcn
centrada con logo "H", título y subtítulo (`useTranslations`/`getTranslations`
namespace `auth.login`), `<LoginForm />`, separador "O", `<GoogleSignInButton />`, footer
con link a `/register` (usar `Link` de `~/i18n/navigation`).

Recibe `searchParams: Promise<{ callbackUrl?: string; error?: string }>` (forma Next 15) y
pasa valores primitivos a los componentes cliente. Si `error` es
`OAuthAccountNotLinked`, muestra `auth.login.oauthAccountNotLinked`; cualquier otro error
OAuth permitido por NextAuth se mapea a `auth.login.oauthFailed`. Nunca renderizar el valor
del query param ni usarlo directamente como clave i18n.

### `login-form.tsx` (`"use client"`)

- Estado controlado email/password (`useState`), validación con
  `loginSchema.safeParse` al submit; errores de campo como texto bajo el input.
- Submit:

```ts
const res = await signIn("credentials", { email, password, redirect: false });
if (res?.error) { setFormError("invalidCredentials"); toast.error(t("invalidCredentials")); return; }
const session = await getSession(); // next-auth/react
const role = session?.user.role;
if (!role) { setFormError("invalidCredentials"); return; }
if (role === UserRole.CUSTOMER || role === UserRole.WORKER) {
  toast(t("mobileOnly"));
  router.push("/");
  return;
}
const callbackUrl = safeCallbackForRole(role, callbackUrlProp);
router.replace(callbackUrl ?? homeForRole(role));
```

- `router` de `~/i18n/navigation` (conserva locale). Error de credenciales SIEMPRE
  genérico (clave `auth.login.invalidCredentials`), nunca distingue email/contraseña.
- Estado `isSubmitting` para deshabilitar el botón.
- El enlace "¿Olvidaste tu contraseña?" usa `Link` a `/forgot-password`, nunca `href="#"`.

### `google-sign-in-button.tsx` (`"use client"`)

Con la versión fijada (`next-auth@5.0.0-beta.25`), usar
`signIn("google", { redirectTo })`. `redirectTo` es `/post-login` y lleva `callbackUrl`
como query solo si el candidato crudo es un path interno; la validación definitiva por rol
ocurre en servidor después de OAuth. Botón `variant="outline"` con icono Google y copy
`auth.login.googleButton`. No usar `callbackUrl` como nombre de opción sin que lo acepte el
tipo instalado y no usar casts.

### `post-login/page.tsx` (Server Component)

```ts
const session = await auth();
if (!session) redirect({ href: "/login", locale });
if (session.user.role === UserRole.CUSTOMER || session.user.role === UserRole.WORKER) {
  return <MobileOnlyRedirect />;
}
const callbackUrl = safeCallbackForRole(session.user.role, searchParams.callbackUrl);
redirect({ href: callbackUrl ?? homeForRole(session.user.role), locale });
```

`MobileOnlyRedirect` usa `useEffect` una sola vez: `toast(t("mobileOnly"))` y
`router.replace("/")`; mientras tanto muestra texto traducido y estado accesible
`role="status"`, sin pantalla en blanco.

### i18n — `auth.json` (es/en)

Namespace `login`: `title`, `subtitle`, `emailLabel`, `emailPlaceholder`,
`passwordLabel`, `forgotPassword`, `submit`, `separator`, `googleButton`, `noAccount`,
`registerCta`, `invalidCredentials`, `oauthAccountNotLinked`, `oauthFailed`,
`redirecting`, `mobileOnly`. Cero strings hardcodeados en JSX.

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

- [ ] Login `admin@home360.mx` (seed) → `/admin`; dueño de "Plomería García" → `/dashboard` (spec §6).
- [ ] Credenciales malas → error genérico bajo el form + toast; sin revelar causa.
- [ ] `?callbackUrl=/dashboard/services` se respeta tras login BUSINESS; `?callbackUrl=https://evil.com` se ignora.
- [ ] BUSINESS no puede usar `callbackUrl=/admin`; ADMIN no puede usar
      `callbackUrl=/dashboard`; paths con `//`, `\` o caracteres de control se ignoran.
- [ ] Login Google → `/post-login` → callback permitido u home por rol; CUSTOMER/WORKER ve
      el aviso `mobileOnly` antes de llegar a `/`.
- [ ] Google con email ya registrado por Credentials muestra
      `oauthAccountNotLinked` traducido, sin vincular cuentas.
- [ ] Copy completo es/en; alternar locale traduce toda la pantalla.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

- Seed de F0 aplicado para las cuentas de prueba (`pnpm db:seed`).
