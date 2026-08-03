# [F1-03] Configurar NextAuth v5 (Credentials + Google, JWT, role en sesión) con config edge-safe

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §1, §3 (uso de `auth()` en middleware) · `spec/00-foundations.md` §8 (env)
- **Depende de**: `F1-01` (loginSchema), `F1-02` (verifyPassword); F0 completada (schema Prisma con `User.role`/`passwordHash`, migración aplicada por Roger)
- **Tamaño estimado**: M

## Contexto

Núcleo de F1: Credentials + Google con sesión JWT (requisito de Credentials en NextAuth v5
beta) conservando `PrismaAdapter` para persistir usuarios/cuentas OAuth.

**Problemas detectados en la spec y resolución**:

1. La spec §3 dice que `middleware.ts` usa "`auth()` (NextAuth edge-safe)", pero la config
   completa importa `PrismaAdapter` (Prisma) y `verifyPassword` (bcryptjs vía `authorize`),
   que **no corren en Edge runtime**. Resolución: patrón oficial de split — una config
   edge-safe (`edge-config.ts`, sin adapter ni providers, solo estrategia JWT + callbacks)
   que el middleware instancia por separado, y la config completa que la extiende para los
   route handlers. Con estrategia JWT el middleware solo necesita decodificar la cookie con
   `AUTH_SECRET`, sin tocar la BD.
2. El `session` callback actual del scaffold usa `({ session, user })` (estrategia
   database). Con `strategy: "jwt"` el callback recibe `({ session, token })`; hay que
   reescribirlo — si se deja como está, `session.user.id` sale `undefined`.
3. La spec pide augmentation de `Session` y `JWT`, pero omite `User`: sin ella, el objeto
   que devuelve `authorize` y el parámetro `user` del callback `jwt` no tipan `role`.
   Resolución: aumentar también `interface User`.
4. `src/env.js` aún declara `AUTH_DISCORD_ID/SECRET` (F0 §1 solo pide quitar el import del
   provider). Resolución: este ticket elimina las vars Discord y agrega las de Google si
   F0 no lo hizo.
5. NextAuth no vincula automáticamente una cuenta Credentials con Google aunque compartan
   email (`OAuthAccountNotLinked`). Se conserva ese comportamiento seguro: **no** usar
   `allowDangerousEmailAccountLinking`. El error vuelve a `/login?error=OAuthAccountNotLinked`
   y F1-07 lo traduce sin revelar más datos.

## Alcance

Crear:

- `src/server/auth/types.ts` (module augmentation)
- `src/server/auth/edge-config.ts`

Modificar:

- `src/server/auth/config.ts` (reescritura completa)
- `src/server/auth/index.ts` (solo si hace falta; la forma actual `NextAuth(authConfig)` + `cache` se conserva)
- `src/env.js` (quitar `AUTH_DISCORD_*`; asegurar `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- `.env.example` (reflejar las vars)

Fuera de alcance: `middleware.ts` (F1-05), UI de login (F1-07), registro (F1-04).

## Detalle técnico

### `types.ts` — module augmentation (spec §1)

```ts
import { type DefaultSession } from "next-auth";
import { type UserRole } from "../../../generated/prisma";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
```

Nota v5 beta: en el callback `jwt` el parámetro `user` puede tipar como
`User | AdapterUser`. Si `AdapterUser` no recoge la augmentation y `user.role` no tipa,
resolver con narrowing (`"role" in user` + validación del valor contra el enum), **nunca**
con cast.

### `edge-config.ts` — compartida y edge-safe

```ts
import { type NextAuthConfig } from "next-auth";
import "./types";

export const edgeAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [], // los providers reales viven en config.ts; el middleware no los necesita
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.id, role: token.role },
    }),
  },
} satisfies NextAuthConfig;
```

Prohibido importar aquí `~/server/db`, `PrismaAdapter`, `bcryptjs` o cualquier servicio
que los use.

### `config.ts` — config completa (Node runtime)

```ts
export const authConfig = {
  ...edgeAuthConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, image: true, role: true, passwordHash: true },
        });
        if (!user?.passwordHash) return null; // usuario OAuth-only o inexistente: mismo fallo genérico
        const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!isValid) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
      },
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // No activar allowDangerousEmailAccountLinking.
    }),
  ],
} satisfies NextAuthConfig;
```

- `authorize` devuelve `null` en todo fallo (input inválido, email inexistente, sin
  passwordHash, contraseña incorrecta): NextAuth responde 401 genérico, nunca se distingue
  la causa (spec §1).
- Google en email nuevo: el `PrismaAdapter` crea el `User` y `role` toma el default de
  Prisma (`CUSTOMER`) — no hace falta lógica extra; el callback `jwt` solo copia
  `user.role` al token en el primer sign-in. Los negocios se crean únicamente vía
  `/register` (spec §1).
- En el callback `signIn`, para Google se exige `profile.email_verified === true` mediante
  narrowing estructural de `profile: unknown`; si falta o es `false`, se rechaza con el
  error genérico de OAuth. No se castea el perfil.
- Un email que ya pertenece a Credentials y no tiene una fila `Account` de Google termina
  en `OAuthAccountNotLinked`; nunca se convierte silenciosamente una cuenta BUSINESS en una
  identidad Google.
- `loginSchema` se importa de `src/schemas/auth/login.schema.ts` (F1-01);
  `verifyPassword` de `src/server/services/auth/password.ts` (F1-02). Eliminar todo rastro
  de `DiscordProvider`.

### `src/env.js`

Server: quitar `AUTH_DISCORD_ID`/`AUTH_DISCORD_SECRET`; agregar
`AUTH_GOOGLE_ID: z.string()` y `AUTH_GOOGLE_SECRET: z.string()` (y sus entradas en
`runtimeEnv`). No tocar las vars de Stripe si F0 ya las dejó.

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

- [ ] `pnpm typecheck` + `pnpm check` en verde; `session.user.role` tipa como `UserRole` sin casts.
- [ ] `edge-config.ts` no importa (ni transitivamente) Prisma ni bcryptjs.
- [ ] Login manual con el usuario seed `admin@home360.mx` crea sesión con `role: "ADMIN"` (verificable en `/api/auth/session`).
- [ ] Credenciales incorrectas devuelven fallo genérico (sin distinguir email vs contraseña).
- [ ] Login con Google crea `User` + `Account` en BD con `role: CUSTOMER` (Roger lo verifica en BD).
- [ ] Google con el email de una cuenta Credentials no vincula cuentas: vuelve a
      `/login?error=OAuthAccountNotLinked`; `allowDangerousEmailAccountLinking` no aparece.
- [ ] `src/env.js` sin vars Discord; `.env.example` documenta `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
- [ ] `pnpm build` en verde además de typecheck/check.

## Comandos para Roger (si aplica)

- Definir en `.env`: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (credenciales OAuth de Google Cloud Console con redirect `http://localhost:3000/api/auth/callback/google`).
- La migración de F0 debe estar aplicada (`pnpm prisma migrate dev`) y el seed cargado (`pnpm db:seed`) para la verificación manual.
