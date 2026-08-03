# [F4-11] Cierre de F4: barrido de i18n de errores y verificación de fase

## Metadatos

- **Fase**: F4 — Suscripciones
- **Spec origen**: `spec/04-subscriptions.md` §6, §7 y criterios de aceptación
- **Depende de**: `F4-02` … `F4-10`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Este ticket cierra la fase: verifica que **ningún código de error quedó sin traducción**,
que la degradación se comporta de punta a punta y deja escrito el guion de verificación
manual que ejecuta Roger con Stripe test-mode.

**Bloqueos que la verificación no oculta**: la spec §7 propone una tarjeta sin definir
dónde se captura; `PENDIENTES.md` #4 no ha elegido Portal, Elements o factura. También
siguen abiertas cancelación/reactivación, IVA/CFDI y política de rotación de Price. No se
reescribe el guion asumiendo `send_invoice`: los pasos que dependan de esas decisiones
quedan marcados `BLOCKED` hasta que Roger las cierre.

Además, aprobar un negocio pertenece a `F5-05`, que depende de F4. Por tanto, F4 puede
cerrar compilación y contratos sin crear un ciclo F4↔F5; el recorrido aprobación→Billing
es una verificación de integración diferida para después de F5-05.

## Alcance

Modificar:

- `src/messages/{es,en}/errors.json` (solo si el barrido detecta faltantes)

Fuera de alcance: cualquier cambio de comportamiento; si el barrido encuentra un bug de
servicio, corregirlo en su ticket y anotarlo, no parchear aquí.

## Detalle técnico

### Barrido de códigos de error

Revisión manual, archivo por archivo (sin script de test):

- Todo código de `ERROR_CODES` (F0 §4), más `subscriptionErrorCodes` (F4-06) y
  `paymentErrorCodes` (F3-11), tiene clave en `errors.json` de **ambos** locales.
- Las rutas de claves de `src/messages/es/**` y `src/messages/en/**` son idénticas: mismo
  conjunto de namespaces y mismas claves dentro de cada uno.
- No eliminar claves ajenas a F3/F4: un agente aislado no puede asumir que una clave de
  otra fase es huérfana. El barrido solo agrega/corrige el conjunto base + payment +
  subscription y comprueba paridad es/en.

### Revisión del router `subscription`

Leer `src/server/api/routers/subscription.ts` y confirmar a ojo:

- `getCurrent` de un negocio **sin** suscripción responde `{ result: null, error: null }`.
- `listInvoices` filtra por `subscription: { businessId: ctx.business.id }` — es la
  garantía de multitenancy y no puede depender de ningún input del cliente.
- `changePlan` vive en `activeBusinessProcedure` y mapea `PLAN_LIMIT_REACHED` a
  `status: 409` con `result: null`.
- `previewChange` devuelve `fits: false` + `exceeds` como **éxito**, no como error.

### Verificación manual (guion para Roger, spec §7)

1. Cuando IVA/CFDI y política de Prices estén decididos, Roger ejecuta el sync → los 3
   `Plan` con Price MXN mensual y comisión local 10/8/5.
2. **Después de F5-05**: aprobar un negocio PENDING desde W10 → en Stripe test-mode aparecen customer +
   subscription; en W7, banner "Plan actual".
3. Con el mecanismo de cobro elegido y el listener iniciado por Roger, completar el pago
   por ese mecanismo → `invoice.paid` → factura visible con PDF y `renewsAt` actualizado.
4. Upgrade `standard → enterprise` desde W7 → el diálogo muestra el prorrateo antes de
   confirmar; tras confirmar, el límite de sucursales cambia en vivo (crear una 6.ª
   sucursal deja de fallar).
5. Downgrade `enterprise → basic` con 3 sucursales → el diálogo lista lo que excede y la
   confirmación queda bloqueada; el servidor responde `PLAN_LIMIT_REACHED` si se fuerza.
6. Provocar mora por el mecanismo aprobado → `PAST_DUE` → banner ámbar y mutations aún
   operativas. `4000…0341` solo aplica si la decisión incluye captura de tarjeta.
7. Provocar `customer.subscription.deleted` por el canal aprobado de cancelación →
   banner de solo-lectura, acciones deshabilitadas (F4-12) y mutation forzada responde 403.
8. Reenviar el mismo evento `invoice.paid` (`stripe events resend <id>`) → sigue existiendo
   **una sola** `Invoice`.

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
- [ ] Ningún código base, de payment o de subscription queda sin clave es/en.
- [ ] Paridad exacta de claves entre `es` y `en`.
- [ ] Cada paso queda `PASS`, `FAIL`, `DEFERRED_F5` o `BLOCKED_BUSINESS_DECISION`; no se
      marca como verificado lo que no pudo ejecutarse.

## Comandos para Roger (si aplica)

```bash
pnpm tsx scripts/sync-stripe-plans.ts
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe events resend <event_id>
```

Son comandos para Roger y algunos tienen efectos en Stripe test-mode; el agente no los
ejecuta. El primero permanece bloqueado por las decisiones indicadas arriba.
