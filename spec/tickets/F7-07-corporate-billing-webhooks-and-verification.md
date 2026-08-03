# [F7-07] Sincronizar Billing corporativo y verificar la fase

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §5–§7 ·
  `spec/08-business-model-alignment.md` D4 · `PENDIENTES.md` #4
- **Depende de**: `F7-03`, `F7-04`, `F7-05`, `F7-06`, `F4-05`, `XC-25`, `XC-26`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Los tickets originales creaban la suscripción corporativa y prometían facturas descargables,
pero ningún webhook podía sincronizar `CorporateMembership`/`CorporateInvoice`: F4 solo
resuelve `Subscription` de negocios. Este ticket cierra el lifecycle Stripe de forma
idempotente y hace la verificación manual integral de F7. La decisión general de captura de
pago sigue abierta en `PENDIENTES.md` #4; la creación/verificación de suscripciones queda
bloqueada hasta que Roger elija. Este ticket no conserva `send_invoice` como default.

## Alcance

Crear:

- `src/server/services/corporate/sync-corporate-membership.ts`
- `src/server/services/corporate/upsert-corporate-invoice.ts`
- `src/server/services/stripe/handlers/corporate-billing-handlers.ts`

Modificar:

- `src/server/services/stripe/webhook-dispatcher.ts` — permitir más de un handler para un
  mismo tipo de evento, sin modificar el route ni verificar dos veces la firma.
- `src/server/api/routers/admin/corporate.ts` y su servicio — procedure
  `reconcileBilling({ accountId })` para reparar una alta interrumpida de forma idempotente.
- `src/messages/{es,en}/admin.json` (solo `corporate.billing.*`) y `corporate.json` (solo
  `billing.*`) si hacen falta códigos/estados nuevos visibles; F7-04 y F7-06 ya son dueños
  del resto de esos namespaces y por eso son dependencias.

Fuera de alcance: Customer Portal/Elements, CFDI/facturación fiscal, facturar consumo de
órdenes, pruebas automatizadas, cambios al Billing de negocios salvo la composición neutral
del dispatcher.

## Detalle técnico

### Dispatch y localización segura

Registrar handlers corporativos para:

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

El dispatcher ejecuta una lista tipada de handlers por evento. Un handler que no reconoce su
dominio retorna éxito sin efecto; no impide que el siguiente lo procese. El route existente
continúa verificando la firma una sola vez y responde 500 si cualquier handler reconocido
falla, para que Stripe reintente.

No autorizar por metadata. Localizar en este orden:

1. `CorporateMembership.stripeSubscriptionId`.
2. `CorporateAccount.stripeCustomerId`.
3. Solo para reparar el crash entre alta remota y persistencia local, metadata
   `corporateMembershipId` + `corporateAccountId`, seguida de consulta que demuestre que ambos
   ids están relacionados y que el customer Stripe coincide. Metadata orienta la búsqueda;
   la BD confirma la pertenencia.

Payloads externos se tratan como `unknown`/tipos del SDK con narrowing, sin `any` ni casts
amplios. Reutilizar `mapStripeSubscriptionStatus`, `getRenewsAt` y el helper version-aware que
extrae subscription id de una factura de F4.

### Membresía

`syncCorporateMembershipFromStripe` hace escritura absoluta e idempotente:

- persiste `stripeSubscriptionId`, estado mapeado y `renewsAt`;
- verifica que el único item usa el `stripePriceId` del tier/configuración o el Price CUSTOM
  de esa cuenta; una discrepancia se registra y no autoasigna términos;
- `customer.subscription.deleted` marca `CorporateMembership.status = CANCELED` y
  `CorporateAccount.status = CANCELLED` en una transacción;
- `past_due`, `unpaid` o `incomplete` actualizan membresía a `PAST_DUE`, pero no inventan una
  suspensión/cancelación de acceso: la política de acceso sigue en
  `CorporateAccount.status`;
- una suscripción con `pause_collection` conserva el status Stripe que corresponda; el
  estado visible de suspensión sale de la cuenta, no de una traducción falsa.

Eventos atrasados no deben resucitar una cuenta `CANCELLED`. Comparar `event.created` con una
marca local de última sincronización (`stripeUpdatedAt` en `CorporateMembership`; agregar el
campo al schema de F7-01 si aún no se incluyó) y omitir eventos más viejos. Guardar el id del
último evento opcionalmente para diagnóstico, nunca como sustituto de idempotencia.

### Facturas consolidadas

`upsertCorporateInvoiceFromStripe`:

```ts
type CorporateInvoiceSyncResult = {
  corporateInvoiceId: string | null;
};
```

- resuelve membresía/cuenta con las reglas anteriores;
- hace `upsert` por `stripeInvoiceId`;
- copia `amount_paid` para pagada o `amount_due` para abierta, siempre entero en centavos;
- mapea `paid -> PAID`, `open | draft | uncollectible -> OPEN`, `void -> VOID` con switch
  exhaustivo y sin `default`;
- persiste `pdfUrl` nullable e `issuedAt`;
- verifica que `CorporateInvoice.corporateAccountId` coincide con el de la membresía.

Una sola suscripción/customer cubre todas las ubicaciones: esta es la “facturación unificada”
que define `spec/09`. No crear una factura por ubicación. El alcance no incluye CFDI ni
consolidar el precio de las órdenes de servicio, que la spec no modela.

Eventos duplicados actualizan la misma fila; eventos Billing ajenos a negocio/corporativo
terminan 200 sin escritura.

### Reconciliación

`admin.corporate.reconcileBilling` usa `adminProcedure` y devuelve
`TrpcResponse<{ id: string }, CorporateErrorCode>`. Invoca los servicios `ensure*` de F7-03,
recupera la suscripción Stripe por id/customer cuando sea necesario y sincroniza membresía.
Es idempotente: segunda ejecución no crea Customer, Subscription, Price ni Invoice.

### Verificación manual

Sin crear tests ni fixtures automatizados, documentar y recorrer con datos de seed/test-mode:

1. ADMIN crea STANDARD, llega invitación y el responsable fija contraseña; login redirige a
   `/corporate` en es/en.
2. ADMIN activa con el mecanismo aprobado en `PENDIENTES.md` §4; repetir no duplica Customer,
   Subscription ni artefactos de captura.
3. Crear ubicaciones hasta 15; la 16 retorna
   `{ result: null, error: "PLAN_LIMIT_REACHED", status: 409, message }`.
4. Orden de una ubicación de esa cuenta: Payment congela 8 %, principal, tasa/monto de
   referencia del plan proveedor y fuente `CORPORATE_ACCOUNT`; cambiar términos no altera
   ese Payment ni el ahorro derivado.
5. Suspender: pausa cobro y mutaciones corporativas dan 403; una orden nueva cae a comisión
   del proveedor. Reactivar revierte ambos efectos.
6. Pagar/finalizar factura test: webhook crea una sola `CorporateInvoice`, visible y con PDF;
   reprocesar evento no duplica.
7. Solicitar cambio de tier: no cambia términos; ADMIN aprueba/rechaza y queda revisor/fecha,
   con una sola solicitud pendiente.
8. BUSINESS, CUSTOMER y ADMIN no acceden a `/corporate`; CORPORATE no accede a
   `admin.corporate.*`; recurso ajeno e inexistente producen respuestas indistinguibles.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` completo en toda procedure; errores estables.
- Rol y tenant desde sesión; filtro dentro de cada query Prisma.
- TypeScript estricto: sin `any`, casts amplios ni `@ts-ignore`; tipos Stripe/Prisma/Zod.
- Identificadores en inglés; copy visible solo next-intl es/en.
- Dinero entero en centavos; formato únicamente en UI.
- Stripe y Prisma inyectados; ninguna llamada externa dentro de transacción.
- **Sin pruebas automatizadas**: no crear `*.test.ts` ni configuración; verificar con
  `pnpm typecheck`, `pnpm check`, `pnpm build` y recorrido manual.
- BD: el agente solo ejecuta `pnpm prisma generate`. Migraciones, seed, SQL, Stripe CLI y
  scripts los ejecuta Roger. Nunca resetear, truncar ni borrar datos.

## Criterios de aceptación

- [ ] Webhooks de negocios y corporativos conviven sin sobrescribirse y sin tocar el route.
- [ ] Eventos duplicados/atrasados no duplican facturas ni revierten estado más reciente.
- [ ] Membresía cancelada deja cuenta `CANCELLED`; suspensión/reactivación conserva coherencia
      entre Stripe y estado local.
- [ ] Una factura corporativa por evento/cuenta, descargable cuando hay `pdfUrl`.
- [ ] `reconcileBilling` repara altas interrumpidas sin duplicar objetos Stripe.
- [ ] Los ocho recorridos manuales dejan evidencia observable y envelopes correctos.
- [ ] `pnpm prisma generate`, `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

```bash
pnpm prisma migrate dev --name add_corporate_accounts
pnpm db:seed
pnpm tsx scripts/sync-stripe-corporate-tiers.ts
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
