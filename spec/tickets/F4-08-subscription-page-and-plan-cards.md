# [F4-08] W7 `/dashboard/subscription`: página, banner de plan actual y cards de planes

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §1 (tabla comercial), §5 (módulo W7)
- **Depende de**: `F4-06` (router), `F4-07` (banner global)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Primera mitad de W7: página, orquestador, banner "Plan actual: Estándar · renueva el 15
ago" y la grilla de 3 cards con precio, comisión y features. Sin diálogos ni mutations
(F4-09) ni facturas (F4-10). Todos los montos y límites llegan del servidor; la UI solo
formatea.

El tratamiento IVA/CFDI sigue abierto (findings #19): las cards muestran el monto almacenado
sin agregar "IVA incluido", "+ IVA" ni promesa de CFDI. Ese calificador y cualquier total
fiscal quedan bloqueados hasta decisión de Roger.

Incluye la deuda registrada en `F3-12`: la tarjeta "Comisión del mes" de W6 debía mostrar
el `%` del plan vigente y se dejó genérica para no acoplar F3 a F4. Aquí se enriquece
consumiendo `subscription.getCurrent` desde el módulo de pagos (llamada tRPC, **sin**
importar nada del `_components` de otro módulo).

**Problema detectado en la spec, resuelto aquí**: §5 lista `past-due-banner.tsx` dentro de
`subscription/_components/`; el banner ya vive en el layout del dashboard (F4-07) y W7 no
lo duplica.

## Alcance

Crear:

- `src/app/[locale]/dashboard/subscription/page.tsx`, `loading.tsx`, `error.tsx`
- `src/app/[locale]/dashboard/subscription/_components/subscription-view.tsx`
- `src/app/[locale]/dashboard/subscription/_components/current-plan-banner.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-cards.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-card.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-feature-list.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-usage-list.tsx`
- `src/app/[locale]/dashboard/subscription/_components/subscription.types.ts`

Modificar:

- `src/messages/{es,en}/dashboard.json`
- `src/app/[locale]/dashboard/payments/page.tsx` y
  `src/app/[locale]/dashboard/payments/_components/payments-view.tsx` +
  `balance-cards.tsx` (deuda de F3-12: `%` del plan en la tarjeta de comisión)

Fuera de alcance: `change-plan-dialog.tsx` y `use-subscription-mutations.ts` (F4-09),
`invoices-section.tsx` (F4-10).

## Detalle técnico

- `page.tsx`: Server Component delgado; prefetch de `subscription.getCurrent` y
  `subscription.listPlans` (patrón `HydrationBoundary` del scaffold T3) → `<SubscriptionView />`.
  `loading.tsx` con `Skeleton` (banner + 3 cards); `error.tsx` estándar del proyecto.
- `subscription.types.ts`: tipos **inferidos del `result` del envelope**, por ejemplo
  `NonNullable<RouterOutputs["subscription"]["getCurrent"]["result"]>` y
  `NonNullable<RouterOutputs["subscription"]["listPlans"]["result"]>[number]`; cero
  duplicación manual de formas. No se confunde `TrpcResponse` con su payload.
- `subscription-view.tsx` (`"use client"`): orquesta las dos queries, lee
  `query.data?.result`/`query.data?.error` y traduce errores estables; `current === null`
  → `empty-state.tsx` (F0) con copy "tu plan se activa cuando aprobemos tu cuenta" y las
  cards en modo informativo (sin botones de cambio).
- `current-plan-banner.tsx`: nombre del plan traducido por `code`, `renewsAt` con
  `useFormatter().dateTime` (formato del diseño: "renueva el 15 ago"), badge de estado
  (`ACTIVE` verde · `PAST_DUE` ámbar · `CANCELED` gris) reutilizando `status-badge.tsx` (F0),
  y `plan-usage-list.tsx` con el uso vs. límites de `getCurrent.usage`
  ("Sucursales 3 de 5", `max: null` → "ilimitadas").
- `plan-cards.tsx`: grid responsivo de 3 (`plan-card.tsx` por plan, orden por `priceCents`).
- `plan-card.tsx`: precio (`priceCents / 100` formateado como MXN — única división
  permitida, es formateo), `commissionPct` (la BD debe reflejar D1: 10/8/5),
  `plan-feature-list.tsx`, y **el botón según su
  relación con el plan actual** (spec §5):
  - plan actual → "Administrar plan" solo si existe el mecanismo aprobado; mientras la
    decisión #4 esté abierta se muestra deshabilitado con tooltip i18n, sin acción falsa;
  - plan posterior en el orden `PLAN_CODES` → "Mejorar plan" (primario);
  - plan anterior → "Cambiar a {plan}" (`outline`).
  En este ticket los botones se renderizan con `onSelectPlan?: (code: PlanCode) => void`
  opcional (aún sin handler) — F4-09 conecta el diálogo. `isAvailable === false`
  (plan sin `stripePriceId`) → botón deshabilitado con tooltip i18n.
  La card del plan actual se resalta (borde/acento) como en el diseño.
- `plan-feature-list.tsx`: lista de checks derivada de los límites del plan; `null` →
  "ilimitado". También incluye los extras normativos de `spec/04` §1 por code:
  `standard` → prioridad en matching IA; `enterprise` → facturación consolidada y soporte
  dedicado. Son claves i18n tipadas por `PlanCode`, no campos inventados en BD.
- **W6 (deuda F3-12)**: `payments/page.tsx` prefetch adicional de `subscription.getCurrent`;
  `payments-view.tsx` pasa `commissionPct` (o `null`) a `balance-cards.tsx`, que titula la
  tarjeta "Comisión del mes ({pct} %)" cuando existe plan y mantiene el título genérico
  cuando no. Ningún cálculo nuevo en cliente.
- i18n `dashboard.json` (es/en): `dashboard.subscription.title`, `…currentPlan.*`,
  `…usage.*`, `…plans.{basic,standard,enterprise}.name`, `…features.*`, `…actions.manage`,
  `…actions.upgrade`, `…actions.switchTo`, `…unavailable`, `…empty.*`; y
  `dashboard.payments.balances.commissionWithPct`.
- Nombres de plan y features **no** se leen de la BD para mostrarse: `Plan.name` existe pero
  el copy visible se traduce por `code` (regla de i18n del proyecto, spec §00 §3).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
  Nada se importa desde el `_components` de otro módulo.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde;
      `/dashboard/subscription` navegable es/en.
- [ ] Las 3 cards replican el diseño (precio, comisión, features, card actual resaltada) y
      el botón correcto por relación con el plan vigente.
- [ ] Comisión 10/8/5 y extras de standard/enterprise coinciden con `08` D1 y `04` §1.
- [ ] Límite `null` se muestra como "ilimitado" en features y en uso.
- [ ] Estados loading / error / sin-suscripción presentes.
- [ ] W6 muestra el `%` del plan vigente en la tarjeta de comisión (deuda F3-12 saldada).
- [ ] Cero strings hardcodeados; todo desde `dashboard.json` es/en.
- [ ] Toda query desempaqueta `TrpcResponse`; errores de dominio no se tratan como payload.

## Comandos para Roger (si aplica)

—
