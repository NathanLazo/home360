# [F4-09] W7 cambio de plan: diálogo con prorrateo y hook de mutations

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §2, §4, §5 (`change-plan-dialog.tsx`), §7
- **Depende de**: `F4-06` (procedures `previewChange`/`changePlan`), `F4-08` (cards con `onSelectPlan`)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Segunda mitad de W7: al elegir un plan se abre un diálogo que consulta el prorrateo real
(`previewChange`) antes de confirmar y que, si el downgrade no cabe, **lista exactamente
qué excede** en vez de dejar al usuario adivinar.

**Problemas detectados en la spec, resueltos aquí:**

1. El detalle de "qué excede" no puede viajar en el error del contrato (`result: null`).
   **Resolución** (ya adoptada en F4-04/F4-06): el diálogo lo obtiene del **resultado
   exitoso** de `previewChange` (`fits`, `exceeds`) y deshabilita la confirmación; el error
   `PLAN_LIMIT_REACHED` de `changePlan` es solo la red de seguridad server-side.
2. La spec no dice **cuándo** se cobra el prorrateo. **Resolución**: con
   `proration_behavior: "create_prorations"` no hay cargo inmediato; el ajuste aparece en la
   próxima factura (`effectiveAt`). El copy lo dice explícitamente para no prometer un cobro
   que no ocurre.
3. §5 asigna a la card actual el botón "Administrar plan" sin definir su acción, y ninguna
   spec define un flujo de cancelación ni de método de pago. **No se inventa una acción**:
   mientras Roger no elija Portal/Elements/factura, el botón queda deshabilitado con una
   explicación traducida. Hacer scroll a facturas no equivale a administrar el plan.

## Alcance

Crear:

- `src/app/[locale]/dashboard/subscription/_components/change-plan-dialog.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-change-summary.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-limit-exceeded-list.tsx`
- `src/app/[locale]/dashboard/subscription/_components/use-subscription-mutations.ts`

Modificar:

- `src/app/[locale]/dashboard/subscription/_components/subscription-view.tsx` (estado del
  diálogo + `onSelectPlan`)
- `src/messages/{es,en}/dashboard.json`

Fuera de alcance: facturas (F4-10); cualquier cambio de servicio o router.

## Detalle técnico

- `use-subscription-mutations.ts`: hook único con `changePlan`
  (`api.subscription.changePlan.useMutation`). El domain error llega como respuesta
  exitosa de transporte: `onSuccess(response)` primero comprueba `response.error` y solo
  con `response.result !== null` muestra éxito. Éxito → toast (sonner) +
  `utils.subscription.getCurrent.invalidate()` + `utils.subscription.listPlans.invalidate()`
  + `utils.subscription.listInvoices.invalidate()`. Error de dominio → toast con
  `t(\`errors.${response.error}\`)`; `onError(unknown)` queda solo para transporte/guardas
  y usa `toErrorCode` (F0-04). Nunca se lee un código de dominio desde
  `TRPCClientError.message`.
- `change-plan-dialog.tsx` (`"use client"`): `Dialog` de shadcn, props
  `{ open, onOpenChange, targetPlanCode: PlanCode | null }`.
  - Consulta `api.subscription.previewChange.useQuery({ planCode }, { enabled: open && targetPlanCode !== null, staleTime: 60_000, retry: false })`.
  - Desempaqueta `query.data?.result`; `query.data?.error` es estado de error de dominio,
    separado de `query.error` (transporte). Estados: cargando (`Skeleton`), error
    traducido + "Reintentar", listo (`plan-change-summary.tsx`), no-cabe.
  - Confirmar deshabilitado mientras carga, si `fits === false`, o si la mutation está en
    vuelo.
- `plan-change-summary.tsx`: plan actual → plan destino, precio mensual del destino y
  **prorrateo**: `prorationCents > 0` → "Se agregarán {monto} a tu próxima factura del
  {fecha}"; `< 0` → "Recibirás un crédito de {monto} en tu próxima factura del {fecha}";
  `=== 0` → "Sin ajustes". Formateo con `useFormatter()` (`cents / 100` como MXN, valor
  absoluto para el texto; el signo lo comunica la frase). **Ningún cálculo de negocio**.
- `plan-limit-exceeded-list.tsx`: recibe `exceeds` con tipo inferido del result de
  `previewChange` y el `usage` de
  `getCurrent`; renderiza una línea por recurso ("Tienes 3 sucursales y el plan Básico
  permite 1"). Puede enlazar branches/products. **No enlaza `/dashboard/team` en F4**:
  ese módulo nace en F6-09, por lo que workers muestra solo orientación traducida hasta F6.
- `subscription-view.tsx`: mantiene `selectedPlanCode` en estado local; `plan-card`
  dispara `onSelectPlan`. La card del plan actual no abre el diálogo (ver Contexto #3).
- Accesibilidad: el diálogo cierra con Esc, el foco vuelve al botón que lo abrió, y el
  botón de confirmar tiene estado `disabled` + `aria-busy` durante la mutation.
- i18n (es/en): `dashboard.subscription.changeDialog.title`, `…description`,
  `…proration.charge`, `…proration.credit`, `…proration.none`, `…confirm`, `…cancel`,
  `…exceeds.title`, `…exceeds.branches|workers|products`, `…exceeds.cta`,
  `…success`, `…retry`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. **Ningún** monto (ni el prorrateo) se
  calcula en el cliente.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Upgrade standard → enterprise muestra el prorrateo **antes** de confirmar (spec §7).
- [ ] Downgrade que no cabe: confirmación deshabilitada + lista de lo que excede; el
      servidor igual responde `PLAN_LIMIT_REACHED` si se fuerza.
- [ ] Tras confirmar: toast de éxito, card del plan actual actualizada y límites nuevos
      vigentes sin recargar (invalidaciones correctas).
- [ ] Cero strings hardcodeados; es/en completos.
- [ ] Errores del envelope y errores de transporte tienen caminos separados y traducidos.
- [ ] F4 no depende en runtime de la ruta `/dashboard/team` que todavía pertenece a F6.

## Comandos para Roger (si aplica)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
