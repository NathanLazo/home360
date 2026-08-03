# [F4-07] Degradación por suscripción: guarda de `activeBusinessProcedure` y banner global

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §2 (PAST_DUE / CANCELED), §5 (`past-due-banner.tsx`)
- **Depende de**: `F4-06` (router `subscription`), `F2-01` (layout del dashboard)
- **Tamaño estimado**: M (1–3 h)

## Contexto

`PAST_DUE` = banner persistente en todo el dashboard, con el negocio plenamente operativo.
`CANCELED` = solo-lectura: ninguna mutation de `activeBusinessProcedure` (catálogo, cobros,
retiros, sucursales) debe ejecutarse. La garantía real es **server-side**, en la guarda
compartida; el banner solo lo explica.

Este ticket no promete "regularizar", cancelar ni reactivar desde HOME360: esos flujos
dependen de la decisión Portal/Elements/factura de `PENDIENTES.md` #4 y del lifecycle
abierto en findings #16. El CTA solo navega a la información de facturación.

**Problemas detectados en la spec, resueltos aquí:**

1. F4 §2 asume que `activeBusinessProcedure` valida la suscripción, pero F0 §5 solo mira
   `business.status` y F4 no declara que modifica `trpc.ts` (ya señalado en `XC-22`).
   **Resolución**: este ticket modifica explícitamente `src/server/api/trpc.ts`; el check
   vive en **un** lugar, nunca disperso por mutation.
2. F0-05 dejó `ctx.business = { id, status, plan: PlanLimits | null }` sin el estado de la
   suscripción. **Resolución**: el `select` existente de `businessProcedure` gana
   `subscription.status` (misma consulta única por request, sin query adicional) y el ctx
   gana `subscriptionStatus: SubscriptionStatus | null`.
3. Las guardas de F0 solo lanzan `TRPCError` `UNAUTHORIZED`/`FORBIDDEN` (decisión F0-05).
   **Resolución**: la guarda de suscripción también lanza `FORBIDDEN` —no se inventa un
   canal nuevo—; la UI distingue el motivo leyendo `subscription.getCurrent`
   (`businessProcedure`, accesible aunque la suscripción esté cancelada). Ver findings #15.
4. La spec §5 pone `past-due-banner.tsx` dentro de `subscription/_components/` pero lo
   describe como "compartido vía layout", lo que viola el aislamiento de módulos
   (`_components` no se importa desde otro módulo). **Resolución**: el banner vive en
   `src/app/[locale]/dashboard/_components/` (propiedad del layout del dashboard); W7 no lo
   duplica.

## Alcance

Modificar:

- `src/server/api/trpc.ts` (`businessProcedure` select + `activeBusinessProcedure` guard)
- `src/app/[locale]/dashboard/layout.tsx` (F2-01: carga del estado + montaje del banner)
- `src/messages/{es,en}/dashboard.json`

Crear:

- `src/app/[locale]/dashboard/_components/subscription-status-banner.tsx`

Fuera de alcance aquí: deshabilitar acciones en cada módulo (trabajo obligatorio separado
en F4-12, findings #18); W7 (F4-08…F4-10).

## Detalle técnico

### `trpc.ts`

```ts
type BusinessContext = {
  id: string;
  status: BusinessStatus;
  plan: PlanLimits | null;
  subscriptionStatus: SubscriptionStatus | null;   // nuevo
};
```

- `businessProcedure`: al `select` existente se agrega `subscription: { select: { status: true, plan: { … } } }`
  (el `plan` ya estaba); se aplana a `plan` + `subscriptionStatus`. **Sigue siendo una sola
  consulta por request** (criterio de F0-05).
- `activeBusinessProcedure`: además del check de `status !== "ACTIVE"`, rechaza con
  `TRPCError({ code: "FORBIDDEN" })` cuando `subscriptionStatus === "CANCELED"` **o**
  `subscriptionStatus === null` (invariante de F5-05: un negocio ACTIVE siempre tiene
  suscripción; si falta, el negocio no está en condiciones de mover dinero).
- `PAST_DUE` **pasa** la guarda: la mora no bloquea la operación (spec §2).
- Comentario en el archivo: "F4 extiende esta guarda (spec/04 §2)".

### Banner

`subscription-status-banner.tsx` (`"use client"`, un solo propósito: renderizar el aviso):

```ts
type Props = { status: SubscriptionStatus | null; renewsAt: Date | null };
```

- `status === "PAST_DUE"` → `Alert` ámbar: título + descripción + link a
  `/dashboard/subscription` ("Ver facturación"; no afirma que exista un cobro embebido).
- `status === "CANCELED"` → `Alert` destructivo: "Cuenta en solo lectura" + link a W7.
- `ACTIVE` o `null` → `null` (no renderiza nada).
- Cero lógica de negocio: recibe el estado por props.

`dashboard/layout.tsx` (Server Component de F2-01): la consulta del negocio que ya se hace
gana `subscription: { select: { status: true, renewsAt: true } }` y pasa los valores al
banner, montado **encima** de `{children}` para que aparezca en todas las vistas del
dashboard. Ninguna consulta extra.

### i18n

Claves nuevas en `dashboard.json` es/en: `dashboard.subscriptionBanner.pastDue.title`,
`…pastDue.description`, `…pastDue.cta`, `…canceled.title`, `…canceled.description`,
`…canceled.cta`.

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

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] El check de suscripción existe en **un solo** lugar (`trpc.ts`), no por mutation.
- [ ] `businessProcedure` mantiene una única consulta Prisma por request.
- [ ] Con suscripción `PAST_DUE`: banner ámbar en todas las vistas del dashboard y
      mutations funcionando.
- [ ] Con suscripción `CANCELED`: banner de solo-lectura y cualquier mutation `active`
      responde 403 traducido.
- [ ] Ningún CTA promete pago/reactivación mientras la decisión de cobro siga abierta.

## Comandos para Roger (si aplica)

Para forzar los estados en test-mode (Stripe Dashboard o test clock): marcar la factura
como impagada (→ `PAST_DUE`) y cancelar la suscripción (→ `CANCELED`) con
`stripe listen` corriendo.
