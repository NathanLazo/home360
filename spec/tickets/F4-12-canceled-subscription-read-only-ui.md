# [F4-12] Aplicar modo solo lectura a las acciones del dashboard

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §2 (`CANCELED` solo lectura);
  `spec/tickets/F3-F4-findings.md` #18
- **Depende de**: `F4-07`, `F4-08`, `F4-09`, `F4-10`
- **Tamaño estimado**: L (3–6 h)

## Contexto

F4-07 protege el servidor, pero dejar botones activos hace que cada intento termine en un
403. Este ticket completa la degradación de UX en las superficies mutables que existen al
cerrar F4. La guarda `activeBusinessProcedure` sigue siendo la autoridad; el estado cliente
solo evita acciones inútiles y explica por qué están bloqueadas.

No implementa pago, cancelación ni reactivación. El CTA y el copy no deben insinuar que
HOME360 puede restaurar la cuenta mientras `PENDIENTES.md` #4 y findings #16 sigan abiertos.

## Alcance

Crear:

- `src/components/dashboard/subscription-access-context.tsx`

Modificar:

- `src/app/[locale]/dashboard/layout.tsx`
- `src/app/[locale]/dashboard/_components/subscription-status-banner.tsx`
- `src/app/[locale]/dashboard/services/_components/services-view.tsx`
- `src/app/[locale]/dashboard/services/_components/service-row-actions.tsx`
- `src/app/[locale]/dashboard/services/_components/service-form-sheet.tsx`
- `src/app/[locale]/dashboard/products/_components/products-view.tsx`
- `src/app/[locale]/dashboard/products/_components/product-row-actions.tsx`
- `src/app/[locale]/dashboard/products/_components/product-form-sheet.tsx`
- `src/app/[locale]/dashboard/products/_components/product-import-dialog.tsx` (si F2-09 lo creó)
- `src/app/[locale]/dashboard/branches/_components/branches-view.tsx`
- `src/app/[locale]/dashboard/branches/_components/branch-card-actions.tsx`
- `src/app/[locale]/dashboard/branches/_components/branch-form-sheet.tsx`
- `src/app/[locale]/dashboard/payments/_components/payments-view.tsx`
- `src/app/[locale]/dashboard/payments/_components/payments-header-actions.tsx`
- `src/app/[locale]/dashboard/payments/_components/connect-onboarding-banner.tsx`
- `src/app/[locale]/dashboard/payments/_components/create-payment-link-dialog.tsx`
- `src/app/[locale]/dashboard/payments/_components/withdraw-dialog.tsx`
- `src/app/[locale]/dashboard/subscription/_components/subscription-view.tsx`
- `src/app/[locale]/dashboard/subscription/_components/plan-card.tsx`
- `src/app/[locale]/dashboard/subscription/_components/change-plan-dialog.tsx`
- `src/messages/{es,en}/dashboard.json`

Fuera de alcance: rutas de solo lectura (home y orders), módulos F5/F6 aún no existentes,
routers/servicios, y cualquier política de cobro o reactivación.

## Detalle técnico

`src/components/dashboard/subscription-access-context.tsx` es compartido explícito (no vive
en el `_components` privado de un módulo):

```ts
type SubscriptionAccessContextValue = {
  status: SubscriptionStatus | null;
  isReadOnly: boolean;
};

export function SubscriptionAccessProvider(props: {
  initialStatus: SubscriptionStatus | null;
  children: React.ReactNode;
}): React.ReactNode;

export function useSubscriptionAccess(): SubscriptionAccessContextValue;
```

- El layout pasa el estado obtenido en F4-07 y envuelve banner + children.
- El provider consulta `subscription.getCurrent` con `businessProcedure`, desempaqueta
  `TrpcResponse` y refresca al volver el foco; puede usar un intervalo sobrio de 60 s para
  reflejar webhooks sin recargar. Ante error conserva `initialStatus`: nunca habilita por
  fallo de red. `isReadOnly = status === "CANCELED"`.
- `PAST_DUE`, `ACTIVE` y `null` no se convierten en solo lectura en cliente. El caso
  `null` sigue bloqueado server-side para mutations active según F4-07.

Aplicación:

1. Botones de alta, edición, cambio de estado, eliminación, CSV, onboarding Connect,
   crear link, retirar y cambiar plan reciben `disabled={isReadOnly}`.
2. Cada botón deshabilitado conserva contexto mediante tooltip/ayuda
   `dashboard.subscription.readOnly.*` en es/en. No usar solo color.
3. Si el estado cambia a `CANCELED` con un Sheet/Dialog abierto, cerrarlo sin enviar y
   descartar el draft local; no llamar mutations desde efectos.
4. Los hooks de mutations no duplican la política. Si una llamada ya estaba en vuelo, se
   deja resolver y manda el servidor; no se falsifica éxito.
5. Navegación, filtros, tablas, PDFs y detalle permanecen accesibles. "Solo lectura" no
   significa ocultar datos.
6. En W7, la card actual no ofrece una acción falsa de "Administrar plan"; ese control
   permanece bloqueado por la decisión de método de pago. Las otras cards también quedan
   deshabilitadas cuando el status es `CANCELED`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- La guarda server-side de `activeBusinessProcedure` no se elimina ni se relaja.
- TypeScript estricto: sin `any`, casts amplios ni `@ts-ignore`; tipos inferidos de tRPC/Prisma.
- Identificadores en inglés; copy visible solo vía next-intl con paridad es/en.
- Un archivo = una responsabilidad; ningún `_components` se importa desde otro módulo.
- **Sin pruebas automatizadas**: no se crean `*.test.ts`; verificación con
  `pnpm typecheck`, `pnpm check`, `pnpm build` y recorrido manual.
- BD/Stripe: ningún comando ni escritura externa por parte del agente.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] `CANCELED`: todas las acciones mutables existentes hasta F4 están deshabilitadas,
      pero consultas, navegación y descarga de facturas siguen disponibles.
- [ ] `PAST_DUE`: banner visible y acciones operativas, como exige la spec.
- [ ] Forzar una mutation `active` en `CANCELED` sigue devolviendo 403; la UI no sustituye
      la autorización del servidor.
- [ ] Un webhook reflejado al recuperar foco actualiza el modo sin recargar la página.
- [ ] Tooltips y explicación de solo lectura tienen claves idénticas en es/en y no prometen
      pago/reactivación.

## Comandos para Roger (si aplica)

— (los estados se verifican después con el canal Stripe decidido; este ticket no prescribe
comandos con efectos).
