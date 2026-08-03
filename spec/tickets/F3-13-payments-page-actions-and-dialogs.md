# [F3-13] W6 acciones: link de cobro, retiro, banner de onboarding Connect

## Metadatos

- **Fase**: F3 — Pagos
- **Spec origen**: `spec/03-payments.md` §3, §6
- **Depende de**: `F3-11`, `F3-12`
- **Tamaño estimado**: L

## Contexto

Segunda mitad de W6: acciones de header ("Crear link de cobro", "Retirar $X" con el
disponible en vivo), los dos dialogs, el banner de onboarding Connect y el hook de
mutations. El bloqueo de retiro > disponible en cliente es **solo UX**: la validación real
es server-side (F3-07/F3-11). Incluye las páginas públicas mínimas de retorno del link
(`/pay/success`, `/pay/cancelled`) referenciadas por F3-08.

Dependencia de integración: el bug no decisional descrito en `PENDIENTES.md` #5 debe estar
corregido en F5-05. Un `stripeAccountId` ficticio hace que `createConnectAccount` lo tome
como válido y el onboarding falle; el banner por `payoutsEnabled === false` no basta para
reparar ese id.

## Alcance

- Crear en `src/app/[locale]/dashboard/payments/_components/`:
  `payments-header-actions.tsx`, `create-payment-link-dialog.tsx`, `withdraw-dialog.tsx`,
  `connect-onboarding-banner.tsx`, `use-payment-mutations.ts`
- Modificar: `payments-view.tsx` (montar header actions + banner)
- Crear: `src/app/[locale]/pay/success/page.tsx`, `src/app/[locale]/pay/cancelled/page.tsx`
  (páginas públicas estáticas con mensaje i18n)
- Modificar: `src/messages/{es,en}/dashboard.json` y `src/messages/{es,en}/common.json`
- Fuera de alcance: aprobación/rechazo de retiros (F5), estilo final de `/pay/*` (F6).

## Detalle técnico

- `use-payment-mutations.ts`: hook único con `startOnboarding`, `refreshConnectStatus`,
  `createPaymentLink` y, solo en la rama manual de `XC-08`, `requestWithdrawal`
  (`api.payment.*.useMutation`). `onSuccess` de
  TanStack no implica éxito de dominio: inspeccionar siempre
  `{ result, error, status, message }`. Solo `error === null && result !== null` muestra
  éxito e invalida `getBalances`/`listTransactions`; un `error` estable se traduce con
  `errors.*`. `onError` queda para fallo de transporte inesperado.
- `payments-header-actions.tsx`: botón secundario "Crear link de cobro" y primario
  "Retirar {amount}" (disponible formateado desde `getBalances`; deshabilitado si
  `availableCents === 0` o sin cuenta Connect con `payoutsEnabled`).
- Si Roger adopta payouts automáticos, no crear `withdraw-dialog.tsx`, no registrar la
  mutation ni renderizar el CTA; mostrar solo el estado/historial que defina `XC-08`.
- `create-payment-link-dialog.tsx`: `Dialog` con form (react-hook-form + zodResolver sobre
  un schema de formulario local; el router conserva su schema server-side en F3-11. El
  monto se captura como **string decimal** en pesos, acepta máximo dos decimales y se
  convierte a centavos con un parser decimal exacto (sin `number * 100`, que introduce
  errores IEEE-754). Tras crear: muestra
  la URL con botón copiar (`navigator.clipboard`) y toast.
- `withdraw-dialog.tsx`: monto (máx. disponible mostrado y validado con Zod
  `.max(availableCents)` client-side), banco (`Input`), últimos 4 dígitos
  (`Input` con `maxLength 4`, patrón `\d{4}`). Confirmación final con resumen
  (monto + banco + ****1234) antes de mutar. Error `INSUFFICIENT_BALANCE` del servidor se
  muestra vía toast traducido (la carrera es posible pese al bloqueo client-side).
- `connect-onboarding-banner.tsx`: `Alert` visible si el negocio no tiene
  `stripeAccountId` **o** `payoutsEnabled === false`, usando
  `payment.getConnectStatus`. CTA → `startOnboarding` → `window.location.href = url`.
  Query param `?onboarding=complete` → ejecutar una sola vez
  `refreshConnectStatus`, invalidar query y mostrar éxito solo si las capacidades reales
  quedaron habilitadas; si no, mantener el Alert con copy accionable.
- Sin cuenta conectada: cobrar sí, liberar/retirar no — el banner lo comunica (copy i18n).
- `requestWithdrawal` y el monto disponible permanecen deshabilitados hasta que Roger
  resuelva `PENDIENTES.md` #1–#3. La UI no presenta una fórmula ni flujo provisional.
- La creación de links permanece bloqueada hasta cerrar la elección de F3-08
  (Payment Links API vs. Session expirable/regenerable).
- i18n: `dashboard.payments.actions.*`, `dashboard.payments.withdraw.*`,
  `dashboard.payments.link.*`, `dashboard.payments.onboarding.*`, `pay.success` / `pay.cancelled`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI. Ningún monto calculado en cliente.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.
- [ ] Flujo manual completo (con Roger): onboarding test → crear link → pagar con `4242…`
      → IN_ESCROW en tabla → forzar cron → RELEASED → retirar → REQUESTED.
- [ ] Retiro > disponible bloqueado client-side **y** rechazado server-side.
- [ ] Banner de onboarding aparece/desaparece según estado real de la cuenta Connect.
- [ ] F5 no persiste un id Connect ficticio; onboarding siempre opera sobre una cuenta
      creada por Stripe o crea una nueva idempotentemente.

## Comandos para Roger (si aplica)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-escrow
```
