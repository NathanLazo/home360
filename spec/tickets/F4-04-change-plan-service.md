# [F4-04] Servicio de cambio de plan: `previewPlanChange` y `changePlan`

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §2 (cambio de plan), §3, §4, §6
- **Depende de**: `F4-02` (`checkDowngradeFit`), `F4-03` (`ensureBillingSubscription`)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Núcleo de W7: cambiar de plan con prorrateo y bloquear los downgrades que no caben. Toda
la aritmética vive aquí; la UI solo muestra centavos ya calculados por el servidor.
Su ejecución depende de que `F4-03` tenga una política de cobro decidida y una suscripción
Stripe real; un agente aislado no debe sortear esa puerta creando una suscripción provisional.

**Problemas detectados en la spec, resueltos aquí:**

1. §2 dice que el downgrade inválido devuelve "`PLAN_LIMIT_REACHED` **con detalle de qué
   excede**", pero el contrato `TrpcResponse` no transporta payload en el error
   (`result: null` + código). **Resolución**: `previewPlanChange` retorna `fits`/`exceeds`
   como **resultado exitoso** (la UI ya tiene el detalle antes de confirmar) y `changePlan`
   solo falla con el código `PLAN_LIMIT_REACHED` (revalidación server-side). Registrado en
   `F3-F4-findings.md` #14.
2. La spec no define el **signo ni la fuente** de `prorationCents`. **Resolución**:
   `prorationCents > 0` = cargo adicional en la próxima factura; `< 0` = crédito a favor;
   se obtiene sumando las líneas con `proration === true` del *invoice preview* de Stripe.
   Con `proration_behavior: "create_prorations"` **no** hay cobro inmediato: el ajuste se
   factura en la próxima renovación, y así debe decirlo el copy (F4-09).
3. La spec no dice qué pasa si el destino es el plan actual, ni si un negocio `PAST_DUE`
   puede cambiar de plan. **Resolución**: mismo plan → `SAME_PLAN` (sin tocar Stripe);
   `PAST_DUE` **sí** puede cambiar (bajar de plan es la salida natural de una mora);
   `CANCELED` → `SUBSCRIPTION_NOT_ACTIVE`.
4. El chequeo de límites se ejecuta **siempre**, sea upgrade o downgrade: comparar precios
   para decidir si "es downgrade" es frágil (un plan puede ser más caro y más restrictivo
   en un recurso). Si el destino cubre todo el uso, el check pasa gratis.

## Alcance

Crear:

- `src/server/services/subscription/change-plan.ts`

Fuera de alcance: procedures (F4-06), UI/diálogo (F4-09), webhooks (F4-05).

## Detalle técnico

```ts
type Deps = { db: PrismaClient; stripe: Stripe };

type ChangePlanError =
  | "NO_SUBSCRIPTION" | "PLAN_NOT_FOUND" | "PLAN_NOT_SYNCED"
  | "SAME_PLAN" | "SUBSCRIPTION_NOT_ACTIVE" | "PLAN_LIMIT_REACHED"
  | "CONFLICT" | "STRIPE_ERROR" | "NOT_FOUND";

previewPlanChange(deps, input: { businessId: string; planCode: PlanCode }):
  Promise<ServiceResult<{
    currentPlanCode: PlanCode;
    targetPlanCode: PlanCode;
    prorationCents: number;      // + cargo / − crédito, en la próxima factura
    effectiveAt: Date;           // fecha de la próxima factura
    fits: boolean;
    exceeds: LimitedResource[];
  }, Exclude<ChangePlanError, "PLAN_LIMIT_REACHED">>>

changePlan(deps, input: { businessId: string; planCode: PlanCode }):
  Promise<ServiceResult<{ planCode: PlanCode; prorationCents: number }, ChangePlanError>>
```

### `previewPlanChange`

1. Cargar `Subscription` por `businessId`: `{ id, status, stripeSubscriptionId, renewsAt, updatedAt, plan: { code, id } }`. Sin fila → `NO_SUBSCRIPTION`.
   Validar el `plan.code` persistido con `planCodeSchema`; valor fuera de catálogo →
   `CONFLICT` con log, nunca cast a `PlanCode`.
2. `db.plan.findUnique({ where: { code: planCode } })` → sin plan `PLAN_NOT_FOUND`;
   `stripePriceId === null` → `PLAN_NOT_SYNCED`; `plan.id === subscription.planId` → `SAME_PLAN`.
3. `checkDowngradeFit(db, businessId, targetPlan)` (F4-02) → `fits` / `exceeds`.
   **No** corta el flujo: el preview siempre responde para que el diálogo explique el motivo.
4. `ensureBillingSubscription` (F4-03) para garantizar `stripeSubscriptionId`; si falla,
   propagar el error tal cual.
5. Preview de Stripe: `stripe.subscriptions.retrieve(stripeSubscriptionId)` → item único
   (`items.data[0]`); si hay 0 o más de 1 item → `svcFail("CONFLICT")` con log server-side
   (invariante "un plan = un item", F4-03).
   Llamar al **preview de factura** que exponga el SDK instalado — `invoices.createPreview`
   en versiones recientes, `invoices.retrieveUpcoming` en las previas — con
   `subscription`, el item actualizado (`{ id: itemId, price: targetPriceId }`) y
   `proration_behavior: "create_prorations"`. Verificar el método en los tipos del paquete
   antes de escribir; **prohibido** castear para forzar una firma.
6. Verificar `preview.currency === "mxn"`; otra moneda → `CONFLICT` con log. Luego
   `prorationCents = Σ line.amount` de las líneas con `proration === true` (enteros, ya en
   centavos MXN; ninguna división).
   `effectiveAt = new Date((preview.next_payment_attempt ?? preview.period_end) * 1000)`;
   si el preview no trae fecha utilizable → `subscription.renewsAt` local.
7. Fallo de Stripe → `STRIPE_ERROR` (el diálogo lo traduce y no permite confirmar).

### `changePlan`

1. Repetir pasos 1–3 de `previewPlanChange` (reusar una función privada `loadChangeContext`
   para no duplicar validaciones).
2. `subscription.status === "CANCELED"` → `SUBSCRIPTION_NOT_ACTIVE`.
3. `fits === false` → `svcFail("PLAN_LIMIT_REACHED", { detail: exceeds.join(",") })`
   **sin ninguna llamada a Stripe** (criterio de la spec §6).
4. `previewPlanChange` para capturar `prorationCents` (valor informativo del resultado).
5. Volver a recuperar la suscripción Stripe inmediatamente antes del update. Si el item ya
   apunta al Price destino (retry tras respuesta perdida/webhook adelantado), no volver a
   crear prorrateos: converger el estado local y devolver éxito.
6. ```ts
   stripe.subscriptions.update(stripeSubscriptionId, {
     items: [{ id: itemId, price: targetPlan.stripePriceId }],
     proration_behavior: "create_prorations",
     metadata: { businessId, planCode },
   }, { idempotencyKey:
     `change-plan-${subscription.id}-${subscription.updatedAt.getTime()}-${targetPlan.id}` })
   ```
   `loadChangeContext` selecciona también `updatedAt`. Dos requests concurrentes desde la
   misma versión comparten key; un cambio posterior A→B después de B→A usa otra versión y
   no recicla una respuesta Stripe histórica.
7. Persistir local con compare-and-set sobre la versión cargada
   (`updateMany({ where: { id, updatedAt }, ... })`); si perdió la carrera, releer y
   converger sin sobrescribir un cambio posterior.
   El webhook `customer.subscription.updated` (F4-05) escribirá lo mismo de forma absoluta:
   los dos caminos convergen sin conflicto.
8. La comisión **no** se recalcula sobre pagos existentes: `commissionPctApplied` quedó
   congelada al capturar (F3-03). Solo los pagos futuros usan el nuevo `commissionPct`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Servicios con `stripe`/`db` inyectados por parámetro (testeables con fakes).
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Downgrade que no cabe **jamás** llega a Stripe.
- [ ] `prorationCents` sale íntegro de Stripe en centavos, con signo documentado.
- [ ] `changePlan` es idempotente ante retry de la misma versión local.
- [ ] Un ciclo A→B→A→B no reutiliza una respuesta idempotente histórica y las carreras no
      sobrescriben un plan posterior.
- [ ] Ningún monto se calcula ni se redondea en este servicio salvo la suma de líneas.

## Comandos para Roger (si aplica)

—
