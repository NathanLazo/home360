# [F0-10] Ampliar el schema de env y crear el scaffolding de Stripe

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §8; `spec/README.md` (variables `.env`)
- **Depende de**: `F0-01` (Discord ya removido de `env.js`), `F0-02` (paquete `stripe`)
- **Tamaño estimado**: S (< 1 h)

## Contexto

Agrega las variables de entorno de Google OAuth y Stripe al schema tipado y deja el
singleton del SDK de Stripe listo para F3/F4.

**Problemas detectados y resoluciones**:

1. **No existe `.env.example`** (la spec dice "actualizado", asumiendo que existe).
   **Resolución**: crearlo desde cero con todas las variables comentadas. No tocar `.env`.
2. **Riesgo de arranque**: si las nuevas variables fueran obligatorias, el dev server no
   arrancaría hasta que Roger consiga credenciales de Google/Stripe. **Resolución**:
   declararlas `z.string().optional()` en desarrollo — mismo patrón que ya usa
   `AUTH_SECRET` (obligatorias solo en producción). Los servicios que las usan (F1/F3)
   fallan con error claro si faltan.

## Alcance

Modificar:

- `src/env.js`

Crear:

- `.env.example`
- `src/server/services/stripe/client.ts`

Fuera de alcance: `CRON_SECRET` (lo agrega F3 con el cron de escrow), webhooks, cualquier
llamada real a Stripe.

## Detalle técnico

`src/env.js` — en `server`:

```js
AUTH_GOOGLE_ID: z.string().optional(),
AUTH_GOOGLE_SECRET: z.string().optional(),
STRIPE_SECRET_KEY: z.string().optional(),
STRIPE_WEBHOOK_SECRET: z.string().optional(),
```

en `client`: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional()`. Reflejar todo en
`runtimeEnv` (incluida la client var con `process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).
Si se prefiere exigirlas en producción, usar el patrón ternario de `AUTH_SECRET`.

Agregar también en `server` y `runtimeEnv`, como opcionales mientras no exista un flujo que
las consuma:

```js
RESEND_API_KEY: z.string().optional(),
EMAIL_FROM: z.string().optional(),
SENDDM_API_KEY: z.string().optional(),
SMS_FROM: z.string().optional(),
```

`.env.example` — cada variable con comentario de origen (una línea): `DATABASE_URL`,
`AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (Google Cloud
Console, OAuth client), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
(`stripe listen` en test mode), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`RESEND_API_KEY`/`EMAIL_FROM` y `SENDDM_API_KEY`/`SMS_FROM`. Valores vacíos o de ejemplo
obvios, jamás reales.

`src/server/services/stripe/client.ts`:

```ts
import "server-only";
import Stripe from "stripe";
import { env } from "~/env";

let stripeSingleton: Stripe | undefined;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  stripeSingleton ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "<literal que exijan los tipos del SDK instalado>",
  });
  return stripeSingleton;
}
```

- `apiVersion`: usar el literal exacto que declare `Stripe.LatestApiVersion` /
  el default tipado del SDK instalado en F0-02 (fijarlo explícito, no omitirlo).
- Regla para fases futuras (documentar en JSDoc): **todo servicio que use Stripe recibe la
  instancia por parámetro** (inyección para tests); `getStripe()` solo se llama en el
  borde (routers/webhooks/cron).

### Notificaciones (D9)

Además de Stripe, el esquema de `env.js` declara los proveedores de notificaciones decididos
en `spec/08-business-model-alignment.md` D9:

- `RESEND_API_KEY` y `EMAIL_FROM` — correo (Resend). Los usa `F1-09` en adelante.
- `SENDDM_API_KEY` y `SMS_FROM` — SMS (send.dm). **Opcionales**: ningún flujo web los usa
  todavía, y exigirlos rompería el arranque sin ganar nada.

Se declaran ahora para que ninguna fase posterior tenga que tocar `env.js` con prisa. Los
contratos/adaptadores inyectables se crean en `F0-13`; este ticket no envía correo ni SMS.

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

- [ ] `pnpm dev` arranca sin las variables nuevas definidas (opcionales en dev).
- [ ] `.env.example` lista las 11 variables: `DATABASE_URL`, `AUTH_SECRET`, 2× Google,
      2× Stripe server, 1× Stripe public, 2× correo y 2× SMS; todas documentadas y sin
      secretos reales.
- [ ] Las 4 variables de notificaciones existen tanto en `server` como en `runtimeEnv` y
      permanecen opcionales.
- [ ] `getStripe()` compila con `apiVersion` literal fijada; `stripe` no se importa desde ningún componente cliente.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Llenar `.env` real con las credenciales (Google OAuth, Stripe test mode).
