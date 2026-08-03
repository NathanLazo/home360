# [XC-01] Relacionar Payment con PaymentLink y hacer opcional orderId

> Ticket transversal (pre-F0). Nace del hallazgo XC-01 de `spec/tickets/XC-findings.md`.

## Metadatos

- **Fase**: XC — corrección transversal de specs (aplicar antes de ejecutar F0)
- **Spec origen**: `spec/00-foundations.md` §3 (modelo `Payment`, modelo `PaymentLink`) ·
  `spec/03-payments.md` §1, §2, §5, §6
- **Depende de**: —
- **Tamaño estimado**: S

## Contexto

`Payment.orderId` es `String @unique` obligatorio en el schema de F0, pero F3 §5 exige
persistir un `Payment` cuando se paga un link de cobro (`checkout.session.completed` →
"marca `PaymentLink.paidAt` + Payment del link"). Un pago de link **no tiene orden**: hoy
es imposible crearlo, y como los 3 saldos derivados de F3 §1 se calculan sobre `Payment`,
el dinero cobrado por link quedaría fuera de escrow/disponible. Resolución elegida:
`orderId` opcional + relación opcional 1:1 `Payment ↔ PaymentLink`, con invariante
"exactamente un origen".

## Alcance

- `spec/00-foundations.md` §3: modificar los modelos `Payment` y `PaymentLink`.
- `spec/03-payments.md` §5: precisar el handler de `checkout.session.completed`.
- Fuera de alcance: cualquier archivo de código (aún no existe F0); crear una `Order`
  sintética para los links (descartado).

## Detalle técnico

En `spec/00-foundations.md` §3, `Payment` queda:

```prisma
model Payment {
  // …
  orderId       String?      @unique
  order         Order?       @relation(fields: [orderId], references: [id])
  paymentLinkId String?      @unique
  paymentLink   PaymentLink? @relation(fields: [paymentLinkId], references: [id])
  // … resto igual
}
```

Y `PaymentLink` gana el lado inverso: `payment Payment?`.

Regla normativa a añadir bajo el modelo (texto de spec): "Invariante: todo `Payment`
tiene exactamente uno de `orderId` | `paymentLinkId` (validado en el servicio
`payments/escrow.ts`; violación → `VALIDATION_ERROR`)."

En `spec/03-payments.md` §5, el bullet de `checkout.session.completed` queda: "→ marca
`PaymentLink.paidAt` y crea el `Payment` con `paymentLinkId` (sin orden), `method:
PAYMENT_LINK`, comisión congelada del plan vigente, `status IN_ESCROW` y
`escrowReleaseAt`". En §6, anotar que `transactions-table.tsx` deriva el "concepto" de
`order.title` o `paymentLink.concept` según el origen.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `spec/00` muestra `Payment.orderId` y `Payment.paymentLinkId` opcionales, únicos y
      con relaciones bidireccionales; el invariante de origen único está escrito.
- [ ] `spec/03` §5 describe la creación del `Payment` del link con los campos exactos.
- [ ] Ninguna otra sección de F3/F5 sigue asumiendo que todo `Payment` tiene orden
      (revisar F5 §3: `resolve` opera solo sobre pagos con orden — sigue válido).

## Comandos para Roger (si aplica)

— (solo edición de specs; la migración correspondiente saldrá con F0).
