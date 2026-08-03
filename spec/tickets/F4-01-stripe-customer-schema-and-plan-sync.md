# [F4-01] `stripeCustomerId` en Business y script de sincronización de planes

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §1, §2
- **Depende de**: F3 base (`F3-01` migrada)
- **Tamaño estimado**: M

## Contexto

F4 necesita (a) `stripeCustomerId` en `Business` — la spec lo agrega en su propia
migración; findings #3 recomienda moverlo a F0, pero como F0 quizá ya migró, el agente
primero inspecciona el schema y solo agrega el campo si aún falta — y (b) los 3 `Plan` del seed
sincronizados con Stripe (Product + Price mensual, `stripePriceId` persistido). El script
lo ejecuta **Roger** una sola vez en test-mode; debe ser idempotente para poder re-correrse.

**Bloqueos de negocio que este ticket no decide:**

- Los importes $499/$999/$1,999 no declaran si incluyen IVA y no existe alcance de CFDI
  (`F3-F4-findings.md` #19). El script se puede escribir, pero Roger **no debe ejecutarlo**
  hasta fijar el tratamiento fiscal del precio que se publicará en Stripe.
- No está decidida la política de cambio de precio para suscriptores vivos
  (`F3-F4-findings.md` #24): conservar el precio contratado o migrar en una renovación.
  Por seguridad, un precio existente cuyo monto difiera **no se rota automáticamente**.
- `Invoice` aún tiene borrado en cascada y puede perder histórico contable
  (`F3-F4-findings.md` #21). Este ticket no cambia la relación porque el hallazgo sigue
  abierto; antes de habilitar eliminación de negocios debe decidirse retención/anonimización.

## Alcance

- Modificar: `prisma/schema.prisma` (`Business.stripeCustomerId String? @unique`)
- Crear: `scripts/sync-stripe-plans.ts`
- Ejecutar (agente): `pnpm prisma generate`
- Fuera de alcance: creación de suscripciones (F4-03); ningún comando de BD ni de Stripe.

## Detalle técnico

Schema:

```prisma
model Business {
  stripeCustomerId String? @unique   // Stripe Billing customer (F4)
}
```

`scripts/sync-stripe-plans.ts` (correr con `pnpm tsx`; usa `env.js` para
`STRIPE_SECRET_KEY` y el singleton `db`):

1. `db.plan.findMany()` — para cada plan:
   - Si `stripePriceId` ya existe → verificar con `stripe.prices.retrieve` que sigue
     activo, en `mxn`, mensual y con `unit_amount === priceCents`; si coincide → skip
     (log "ok"). Si difiere o está inactivo → log "blocked-price-change", no crear ni
     actualizar nada y terminar con exit code distinto de cero. Rotar aquí inventaría la
     política abierta de migración/grandfathering.
   - Si no existe: buscar Product por `metadata.planCode` (`stripe.products.search`) o
     crearlo (`name: plan.code`, `metadata: { planCode: plan.code }`); crear Price
     (`currency: "mxn"`, `unit_amount: plan.priceCents`,
     `recurring: { interval: "month" }`, `metadata: { planCode }`); persistir
     `stripePriceId`.
2. Antes de tocar Stripe, validar exactamente los tres códigos `basic`, `standard`,
   `enterprise`, precios `49900/99900/199900`, comisiones normativas `10/8/5` (D1) y
   límites de `spec/04` §1. Cualquier divergencia bloquea y no hace escrituras parciales.
3. Salida por consola: tabla plan → priceId → acción. Exit code ≠ 0 si algún plan quedó
   sin `stripePriceId` o requiere una decisión de precio.
- El script es el **único** lugar donde se crean Products/Prices; `changePlan` (F4-04)
  falla con `PLAN_NOT_SYNCED` si un plan no tiene `stripePriceId`.

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

- [ ] `pnpm prisma generate` · `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Script idempotente: segunda ejecución no crea Products/Prices duplicados.
- [ ] Cambio de `priceCents`, moneda, intervalo o Price inactivo → el script se detiene sin
      rotar ni dejar suscriptores vivos en una política no decidida.
- [ ] Valida antes de Stripe la escalera normativa 10/8/5 y los importes/límites de los tres planes.

## Comandos para Roger (si aplica)

```bash
pnpm prisma migrate dev --name add_stripe_customer_id
pnpm tsx scripts/sync-stripe-plans.ts
```

No ejecutar `sync-stripe-plans.ts` hasta resolver IVA/CFDI y, si hay un Price divergente,
la política de cambio de precio. Estos comandos son exclusivamente para Roger.
