# [XC-08] Cerrar el contrato de retiros entre saldo, Connect y administración

## Metadatos

- **Fase**: XC — contrato transversal F0/F3/F5
- **Spec origen**: `PENDIENTES.md` decisión 3 · `spec/03-payments.md` §1–§4 ·
  `spec/05-admin.md` §4 · `spec/00-foundations.md` §3
- **Depende de**: `F3-01` y decisión 3 de `PENDIENTES.md` resuelta por Roger
- **Tamaño estimado**: M (1–3 h)

## Contexto

`releasePayment` ya mueve el neto desde la plataforma a la cuenta Connect mediante un
`Transfer`. Después, F3/F5 llaman “retiro” indistintamente a otro `Transfer` o a un `Payout`,
y `Withdrawal.stripeTransferId` no identifica de forma fiable qué objeto guarda. Además,
Stripe Express puede usar payouts automáticos o manuales. Este ticket propaga la opción que
Roger decida; no autoriza elegirla ni ejecutar operaciones de Stripe.

## Alcance

- Reconciliar únicamente `prisma/schema.prisma` y el contrato documentado de nombres,
  estados e idempotency keys con el objeto Stripe real.
- F3-02/F3-07/F3-09/F3-11/F3-13 y F5-11/F5-12 consumen la rama aprobada y conservan
  ownership exclusivo de servicios, routers, handlers, UI y copy.
- Fuera de alcance: editar archivos F3/F5, decidir la política, ejecutar migraciones, crear
  cuentas Connect, llamar Stripe en vivo o cambiar las fórmulas de saldo de `XC-03`.

## Detalle técnico

Aplicar exactamente una rama, citando la decisión registrada:

### Rama A — payout manual solicitado y aprobado

- `releasePayment` conserva el `Transfer` al liberar escrow.
- La cuenta Connect se configura con payout schedule manual.
- `approveWithdrawal` crea `stripe.payouts.create(..., { stripeAccount })`.
- Renombrar el campo a `Withdrawal.stripePayoutId String? @unique`; no guardar un id `po_*`
  bajo un nombre `stripeTransferId`.
- Idempotency key: `payout-withdrawal-${withdrawalId}`.
- Máquina terminal: `REQUESTED → APPROVED|REJECTED`; doble resolución → `CONFLICT`.

### Rama B — payouts automáticos de Stripe

- Stripe controla la salida bancaria; W6 no permite solicitar un payout manual y W12 no
  ofrece aprobarlo.
- `Withdrawal` deja de representar una solicitud administrable. Si se conserva como historial
  sincronizado, documentar su fuente y usar el identificador real del payout; no crear filas
  `REQUESTED` que nadie pueda ejecutar.
- Retirar del saldo disponible solo movimientos bancarios cuya semántica esté definida; no
  descontar simultáneamente un request local y un payout automático.

En ambas ramas:

- `Payment.stripeTransferId` sigue representando exclusivamente el Transfer de liberación.
- El router traduce todos los códigos de dominio a `TrpcResponse` y `errors.json` contiene
  paridad es/en.
- F5-11 y F3-07 deben describir el mismo objeto y la misma transición.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos Stripe/Prisma reales.
- Copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- **Sin pruebas automatizadas**: verificación con `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- No ejecutar comandos ni llamadas de Stripe.

## Criterios de aceptación

- [ ] Existe una sola semántica de retiro en F3/F5 y coincide con la decisión de Roger.
- [ ] Ningún id de Payout se guarda en un campo llamado Transfer ni viceversa.
- [ ] El disponible descuenta cada retiro exactamente una vez.
- [ ] Doble aprobación/rechazo no duplica dinero y retorna un código estable traducido.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

La migración de renombre, si la rama elegida la requiere, la prepara el agente como archivos;
Roger decide cuándo ejecutarla. No ejecutar comandos Stripe desde este ticket.
