# [XC-08] Cerrar el contrato de retiros entre saldo, Connect y administración

## Metadatos

- **Fase**: XC — contrato transversal F0/F3/F5
- **Spec origen**: `PENDIENTES.md` decisión 3 · `spec/03-payments.md` §1–§4 ·
  `spec/05-admin.md` §4 · `spec/00-foundations.md` §3
- **Depende de**: `F3-01` y decisión 3 de `PENDIENTES.md` (**resuelta por Roger**)
- **Estado**: **DESBLOQUEADO** — payout manual solicitado y aprobado.
- **Tamaño estimado**: M (1–3 h)

## Contexto

`releasePayment` ya mueve el neto desde la plataforma a la cuenta Connect mediante un
`Transfer`. Después, F3/F5 llaman “retiro” indistintamente a otro `Transfer` o a un `Payout`,
y `Withdrawal.stripeTransferId` no identifica de forma fiable qué objeto guarda. Además,
Stripe Express puede usar payouts automáticos o manuales. Roger aprobó el flujo manual;
este ticket fija sus nombres, estados e idempotencia sin ejecutar operaciones de Stripe.

## Alcance

- Reconciliar únicamente `prisma/schema.prisma` y el contrato documentado de nombres,
  estados e idempotency keys con el objeto Stripe real.
- F3-02/F3-07/F3-09/F3-11/F3-13 y F5-11/F5-12 consumen la rama aprobada y conservan
  ownership exclusivo de servicios, routers, handlers, UI y copy.
- Fuera de alcance: editar archivos F3/F5, decidir la política, ejecutar migraciones, crear
  cuentas Connect, llamar Stripe en vivo o cambiar las fórmulas de saldo de `XC-03`.

## Detalle técnico

Aplicar la decisión registrada:

### Rama aprobada — payout manual solicitado y aprobado

- `releasePayment` conserva el `Transfer` al liberar escrow.
- La cuenta Connect se configura con payout schedule manual.
- `approveWithdrawal` crea `stripe.payouts.create(..., { stripeAccount })`.
- Renombrar el campo a `Withdrawal.stripePayoutId String? @unique`; no guardar un id `po_*`
  bajo un nombre `stripeTransferId`.
- Idempotency key: `payout-withdrawal-${withdrawalId}`.
- El claim `REQUESTED → PROCESSING` congela la cuenta Connect en
  `Withdrawal.payoutStripeAccountId`. Los guards mutables del negocio aplican antes del
  claim; un retry `PROCESSING` usa ese snapshot aunque el negocio cambie después.
- Máquina operativa aprobada:
  - `REQUESTED → PROCESSING → APPROVED`;
  - `REQUESTED → REJECTED`;
  - eventos Stripe absolutos pueden reconciliar `PROCESSING|APPROVED → FAILED|CANCELED`.
- El disponible reserva `REQUESTED|PROCESSING|APPROVED` y libera
  `REJECTED|FAILED|CANCELED`; cada retiro se descuenta exactamente una vez.
- Doble claim o resolución incompatible retorna `CONFLICT`; retries de `PROCESSING` usan la
  misma idempotency key/cuenta y convergen al mismo Payout. Si la carrera ya observa
  `APPROVED` con id persistido, devuelve ese éxito sin otra llamada remota.

Además:

- `Payment.stripeTransferId` sigue representando exclusivamente el Transfer de liberación.
- El router traduce todos los códigos de dominio a `TrpcResponse` y `errors.json` contiene
  paridad es/en.
- F5-11 y F3-07 deben describir el mismo objeto y la misma máquina de estados.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos Stripe/Prisma reales.
- Copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- **Sin pruebas automatizadas**: verificación con `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- No ejecutar comandos ni llamadas de Stripe.

## Criterios de aceptación

- [ ] Existe una sola semántica de retiro — Payout manual — en F3/F5.
- [ ] Ningún id de Payout se guarda en un campo llamado Transfer ni viceversa.
- [ ] El disponible descuenta cada retiro exactamente una vez.
- [ ] Doble aprobación/rechazo no duplica dinero y retorna un código estable traducido.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

La migración de renombre, si la rama elegida la requiere, la prepara el agente como archivos;
Roger decide cuándo ejecutarla. `payoutStripeAccountId` se agrega nullable. Filas
`PROCESSING` preexistentes se rellenan solo tras verificar que `Business.stripeAccountId`
sigue siendo la cuenta usada al reclamar; las demás permanecen para reconciliación manual.
No ejecutar comandos Stripe desde este ticket.
