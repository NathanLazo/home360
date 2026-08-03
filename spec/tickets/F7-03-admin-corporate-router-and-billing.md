# [F7-03] Router `admin.corporate`, alta con Billing y comisión preferente

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §3, §5 · `spec/08-business-model-alignment.md` D1, D4
- **Depende de**: `F7-02`, `F4-03` (patrón de Billing), `F3-03`
  (`resolveCommissionPct`), `XC-25` (principal monetario) y `XC-26` (snapshot de referencia)
- **Tamaño estimado**: L (3–6 h)
- **Estado**: alta/CRUD implementables; activación y cambios de Billing bloqueados por
  `PENDIENTES.md` §4 hasta que Roger defina el método de cobro.

## Contexto

El corazón de la fase: administrar cuentas corporativas y **activar la rama corporativa de la
comisión**, que `F3-03` dejó preparada como punto de extensión.

Ojo con el efecto compuesto al negociar términos: la comisión preferente reduce el ingreso de
plataforma y, como el bono de lealtad (D3) es un porcentaje de esa comisión, también reduce el
incentivo que recibe el proveedor. Un `CUSTOM` al 3 % golpea las dos cosas a la vez. El
formulario de términos debe mostrarlo, no esconderlo.

## Alcance

Crear:

- `src/server/services/corporate/corporate-accounts.ts` (alta, activación, términos, estado)
- `src/server/services/corporate/corporate-billing.ts` (customer y suscripción corporativos;
  no reutilizar funciones de F4 tipadas exclusivamente para `businessId`)
- `src/server/services/email/send-corporate-invitation.ts` (usa `EmailClient` de F0-13;
  no importa Resend directamente)
- `src/server/api/routers/admin/corporate.ts`
- `scripts/sync-stripe-corporate-tiers.ts` (lo ejecuta Roger)

Modificar:

- `src/server/services/payments/escrow.ts` — activar la rama corporativa de
  `resolveCommissionPct`.
- el router agregador de `src/server/api/routers/admin/` — montar `corporate`; modificar
  `src/server/api/root.ts` solo si F5 lo dejó como punto real de composición.

Fuera de alcance: UI (F7-04); dashboard del cliente (F7-05/F7-06).

## Detalle técnico

### Comisión preferente (D1)

En `resolveCommissionPct` (F3-03) se activa el primer escalón, que hasta ahora era un
comentario:

```ts
if (corporateAccountId) {
  const account = await db.corporateAccount.findUnique({
    where: { id: corporateAccountId },
    select: { commissionPct: true, status: true },
  });
  if (account?.status === "ACTIVE") return account.commissionPct;
  // suspendida o cancelada ⇒ cae al plan del proveedor
}
```

El porcentaje se sigue congelando en el `Payment`: renegociar términos **no** reescribe
pagos históricos, igual que con los planes.

Consumir `CommissionResolution` de `XC-26`, que resuelve en la misma operación porcentaje
efectivo, porcentaje de referencia del plan y fuente. Al crear `Payment`, congelar
`providerPlanCommissionPctApplied`, `providerPlanCommissionCents` y `commissionSource` con
los nombres exactos de ese ticket. El ahorro derivado es:

```text
savedByRateCents = max(0, providerPlanCommissionCents - commissionCents)
```

Ambas comisiones se calculan sobre el principal definido en `XC-25`, no sobre tarifa de
servicio ni total ambiguo. Pagos no corporativos guardan `commissionSource=PROVIDER_PLAN` y
ambos montos coinciden. El cálculo ocurre una sola vez en servidor y el webhook duplicado
retorna el Payment existente sin recalcular.

`capturePayment` no acepta un `corporateAccountId` arbitrario del webhook. Cuando el target es
una orden, carga en el mismo `select` mínimo `Order.corporateAccountId` y lo entrega a
`resolveCommissionPct`; cuando es un payment link, pasa `null`. Si la orden tiene además
`corporateLocationId`, validar al crear/aceptar la orden que esa ubicación pertenece a la
misma cuenta. Nunca confiar en metadata de Stripe para decidir tenant o porcentaje.

### Procedures (`adminProcedure`)

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` | `{ status?, tier?, search?, cursor? }` | cuentas con ubicaciones, gasto del mes y estado |
| `getById` | `{ accountId }` | expediente: términos, ubicaciones, órdenes, membresía |
| `create` | `{ name, taxId?, ownerEmail, tier, commissionPct?, monthlyFeeCents?, maxLocations?, accountManagerId? }` | `{ id }` · `EMAIL_TAKEN` si el correo ya tiene cuenta |
| `activate` | `{ accountId }` | `{ id }` · `CONFLICT` si ya está activa · `STRIPE_ERROR` |
| `updateTerms` | `{ accountId, tier, commissionPct, monthlyFeeCents, maxLocations, accountManagerId? }` | `{ id }` · `VALIDATION_ERROR` si los términos no corresponden al tier o el límite queda bajo uso |
| `suspend` / `reactivate` | `{ accountId, reason? }` | `{ id }` |
| `rejectTierChange` | `{ accountId, requestId, reason }` | `{ id }` · `NOT_FOUND` · `CONFLICT` |

Cada procedure retorna el envelope completo:
`{ result: T | null, error: ErrorCode | null, status: number, message: string }`.
Usar Zod: ids `cuid`, email normalizado, nombre `min(2)`, `monthlyFeeCents` entero
no negativo, `maxLocations` entero positivo o `null`, `commissionPct` entero `0..100`.
Para `BASIC`, `STANDARD` y `ENTERPRISE`, los defaults salen de
`CorporateTierConfig`; overrides explícitos solo se permiten a ADMIN y quedan auditables.
`CUSTOM` exige `monthlyFeeCents`, `commissionPct` entre `0` y `4` y
`maxLocations: null` o `>= 51`. Los demás tiers respetan sus rangos de ubicaciones
(`<=3`, `4..15`, `16..50`) sin convertir el límite máximo en una obligación de uso mínimo.
`STANDARD`, `ENTERPRISE` y `CUSTOM` exigen `accountManagerId` de un usuario ADMIN existente;
`BASIC` lo admite opcionalmente. Id ajeno/inexistente → `VALIDATION_ERROR`.

`create` **no genera contraseña**: crea el `User` con rol `CORPORATE` sin `passwordHash` y
emite invitación, igual que el alta de trabajadores. El agente nunca fabrica credenciales.
Normaliza `ownerEmail` y hace `User` + `CorporateAccount` en una transacción; el envío ocurre
después del commit. Reutiliza el flujo seguro de token de F1-09 para que el responsable fije
su contraseña (token aleatorio, solo hash persistido, 1 h, un enlace vivo), con locale
explícito y sin registrar token/correo completo. Si Resend falla, la cuenta permanece
`PENDING`, se registra un error sin PII y `create` retorna `EMAIL_DELIVERY_FAILED`; reintentar
el alta con el mismo correo no duplica usuario: debe existir una operación idempotente de
reenvío o `create` debe detectar la cuenta pendiente y reenviar.

`activate`, siguiendo el orden que `F5-findings` F5-1 enseñó por las malas — **las llamadas a
Stripe van fuera de la transacción Prisma**:

1. Validar estado `PENDING` (la reactivación usa `reactivate`) y cargar términos/configuración
   con `select` mínimo → si no, `CONFLICT`.
2. Transacción local idempotente: crear/obtener `CorporateMembership` sin id Stripe y sin
   cambiar aún la cuenta a `ACTIVE`.
3. `ensureCorporateStripeCustomer` + `ensureCorporateBillingSubscription` sobre el price del
   tier, **solo después** de la decisión de `PENDIENTES.md` §4. Reutilizar exactamente el
   mecanismo aprobado en F4-03 (Portal, Elements o `send_invoice`) sin elegir defaults
   corporativos distintos; metadata contiene
   `corporateAccountId`, `corporateMembershipId` y `corporateTier`, nunca datos fiscales.
   Customer y subscription llevan idempotency keys derivadas de ids locales.
4. Transacción local: `status = ACTIVE` + update de `CorporateMembership` con
   `stripeSubscriptionId` y `renewsAt`.
5. Si el paso 4 falla tras crear la suscripción, se registra y se reporta `STRIPE_ERROR` con
   el id de suscripción en el log: se resuelve reintentando `activate`, que es idempotente
   por `stripeSubscriptionId @unique`.

La persistencia final usa `updateMany(... stripeSubscriptionId: null)` y relee en caso de
carrera. Ninguna llamada externa ocurre dentro de `db.$transaction`.

`updateTerms` valida primero uso activo y reglas de tier. Si cambia cuota/tier de una cuenta
activa, actualiza el único item de Stripe con `proration_behavior: "create_prorations"` fuera
de la transacción; solo después persiste términos locales y marca como `APPROVED` la solicitud
`PENDING` seleccionada, si se recibió `requestId`. Un fallo Stripe deja los términos locales
intactos. Si no cambia el Price/cuota, la actualización es solo local. Los Price son
inmutables: un `CUSTOM` requiere un Price mensual por cuenta, localizado por metadata e
idempotency key; nunca se reutiliza el Price de otra cuenta.

Al aprobar o rechazar una solicitud, filtrar por `id + corporateAccountId + status=PENDING`,
guardar `reviewedById/reviewedAt` y poner `pendingKey = null` en la misma transacción.
`rejectTierChange` exige razón y nunca modifica términos.

`suspend` exige razón no vacía, cambia solo el acceso corporativo y aplica el mecanismo de
pausa/cancelación que Roger apruebe junto con `PENDIENTES.md` §4, siempre fuera de la
transacción; si Stripe falla no confirma la suspensión local. `reactivate` revierte ese mismo
mecanismo, sincroniza estado/renovación y después reactiva localmente.
`CANCELLED` queda reservado al webhook `customer.subscription.deleted` de F7-07 y no puede
reactivarse por esta procedure.

### Script de tiers

`scripts/sync-stripe-corporate-tiers.ts`: crea Product + Price mensual por tier
(`BASIC`/`STANDARD`/`ENTERPRISE`; `CUSTOM` no se sincroniza, su precio se fija por cuenta) y
persiste el price id en `CorporateTierConfig.stripePriceId`. Idempotente, mismo patrón que
`sync-stripe-plans.ts` de `F4-01`: verifica moneda `mxn`, intervalo mensual y `unit_amount`;
si cambia una cuota rota a un Price nuevo sin borrar/desactivar el anterior que aún pueda
tener suscripciones vivas.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; errores como códigos estables.
- Todo el namespace admin con `adminProcedure`; 403 uniforme sin revelar recursos.
- Servicios con `stripe`/`db` inyectados por parámetro; ninguna llamada a Stripe dentro de
  una transacción Prisma.
- TypeScript estricto: sin `any`; enums de Prisma, no strings sueltos.
- Identificadores en inglés; dinero en centavos; ningún monto calculado en cliente.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] Una orden de cuenta corporativa `ACTIVE` congela la comisión de la cuenta; con la
      cuenta suspendida usa la del plan del proveedor.
- [ ] El porcentaje corporativo sale de la orden persistida, nunca de input o metadata.
- [ ] `activate` es idempotente y no crea dos suscripciones en Stripe.
- [ ] `activate` no llama Stripe mientras `PENDIENTES.md` §4 siga abierto; después consume
      exactamente el contrato aprobado en F4-03.
- [ ] Alta e invitación no generan contraseñas; un fallo de correo no duplica usuario/cuenta
      al reenviar.
- [ ] Suspender pausa cobro y reactivar lo reanuda; un fallo Stripe no deja estado local
      afirmando una transición que Stripe no realizó.
- [ ] `updateTerms` no altera ningún `Payment` existente.
- [ ] Los campos de referencia de `XC-26` quedan congelados al capturar y no cambian por
      actualizaciones futuras.
- [ ] Fallo al prorratear/cambiar Price deja los términos locales anteriores intactos.
- [ ] `maxLocations` no puede quedar por debajo de las ubicaciones activas.
- [ ] Aprobar/rechazar solicitudes registra revisor y libera `pendingKey` atómicamente.
- [ ] Todas las procedures retornan las cuatro propiedades de `TrpcResponse`, con
      `error: null` en éxito y `result: null` en fallo.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

```bash
pnpm tsx scripts/sync-stripe-corporate-tiers.ts
```
