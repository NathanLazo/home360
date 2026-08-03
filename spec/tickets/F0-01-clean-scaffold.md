# [F0-01] Limpiar restos del scaffold T3 (Post, Discord)

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §1
- **Depende de**: —
- **Tamaño estimado**: S (< 1 h)

## Contexto

El scaffold create-t3-app dejó restos que hoy **rompen el build**: `prisma/schema.prisma`
declara `posts Post[]` en `User` pero el modelo `Post` ya no existe (→ `prisma generate`
falla), `src/app/page.tsx` importa `LatestPost`, `auth` y `api` sin usarlos, y
`src/server/auth/config.ts` importa `DiscordProvider` sin uso.

**Problema detectado (hueco de la spec)**: la spec §1 no menciona que `src/env.js` todavía
exige `AUTH_DISCORD_ID` y `AUTH_DISCORD_SECRET` como variables obligatorias — sin ellas la
app ni siquiera arranca. **Resolución**: eliminarlas de `env.js` en este ticket (la spec §8
solo agrega variables nuevas; las de Discord son parte de la limpieza).

## Alcance

Modificar:

- `prisma/schema.prisma` — quitar la línea `posts Post[]` del modelo `User` (nada más;
  el schema completo del dominio llega en F0-03).
- `src/app/page.tsx` — eliminar imports sin uso (`Link`, `LatestPost`, `auth`, `api`);
  conservar `HydrateClient` solo si se sigue usando (si no, dejar un componente mínimo
  que retorne `null`-safe JSX). La página se moverá bajo `[locale]` en F0-07.
- `src/server/auth/config.ts` — quitar `import DiscordProvider …`.
- `src/env.js` — eliminar `AUTH_DISCORD_ID` y `AUTH_DISCORD_SECRET` de `server` y de
  `runtimeEnv`.

Eliminar:

- `src/app/_components/post.tsx`

Fuera de alcance: nuevas variables de entorno (F0-10), schema de dominio (F0-03).

## Detalle técnico

- Tras el cambio, `pnpm prisma generate` debe completar sin errores con el schema mínimo
  (modelos NextAuth: `Account`, `Session`, `User`, `VerificationToken`).
- `src/app/page.tsx` queda como placeholder mínimo sin imports muertos:

```tsx
export default function Home() {
  return null;
}
```

(El contenido real de landing llega en F6; la reubicación bajo `[locale]/(public)/` es de F0-07.)

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

- [ ] `pnpm prisma generate` termina sin errores.
- [ ] `rg -i "post" src prisma` no devuelve restos del scaffold (solo coincidencias legítimas).
- [ ] `rg -i "discord" src` no devuelve nada.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno; no hay migración en este ticket).
