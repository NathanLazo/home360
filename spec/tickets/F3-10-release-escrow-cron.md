# [F3-10] Route handler de auto-liberación de escrow (`api/cron/release-escrow`)

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §5 (auto-liberación)
- **Depende de**: `F3-04`
- **Tamaño estimado**: S

## Contexto

Expone `releaseDuePayments` (F3-04) como endpoint protegido por `CRON_SECRET`, invocable
por Vercel Cron o manualmente en dev. La exclusión de pagos en disputa ya vive en el
servicio (F3-04); este ticket solo agrega transporte + auth + env.

## Alcance

- Crear: `src/app/api/cron/release-escrow/route.ts`
- Modificar: `src/env.js` (agregar `CRON_SECRET` server-side, requerido)
- Modificar: `.env.example` (documentar `CRON_SECRET`)
- Fuera de alcance: programación del cron en Vercel (infra de Roger).

## Detalle técnico

```ts
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`)
    return new Response("unauthorized", { status: 401 });   // sin detalle extra
  const result = await releaseDuePayments({ db, stripe });
  return result.ok
    ? Response.json(result.data)
    : new Response("error", { status: 500 });
}
```

- También aceptar `GET` con la misma guarda (Vercel Cron invoca GET por defecto): ambos
  métodos delegan a una función local compartida.
- Declarar `export const dynamic = "force-dynamic"` y responder `Cache-Control: no-store`;
  un endpoint que mueve dinero nunca puede reutilizar una respuesta cacheada.
- El endpoint ejecuta un lote acotado de F3-04 y expone `hasMore`; no implementa un bucle
  sin límite dentro de una sola invocación.
- Los fallos conservan `escrowReleaseAttemptedAt`; F3-04 aplica cooldown y ordena primero
  timestamps nulos y luego el intento más antiguo. Así los no intentados avanzan y los
  retries rotan sin que los 100 pagos más antiguos causen starvation.
- Comparación del secreto en tiempo constante no requerida (token largo aleatorio), pero el
  401 no debe filtrar si el header faltó o no coincidió.
- Sin `CRON_SECRET` en env → `src/env.js` falla al arrancar (variable requerida).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Sin header o secreto incorrecto → 401; con secreto → ejecuta y reporta conteos.
- [ ] `.env.example` documenta `CRON_SECRET`.

## Comandos para Roger (si aplica)

Agregar `CRON_SECRET` a `.env`. Prueba manual:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-escrow
```
