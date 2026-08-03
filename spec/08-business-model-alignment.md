# Alineación con el deck — decisiones adoptadas

Documento **normativo**. Resuelve los conflictos entre el deck de socios, el diseño web
(W1–W13) y el diseño de la app móvil, detectados en
[`07-product-context.md`](07-product-context.md). Donde una spec `00`–`06` contradiga algo
de aquí, manda este documento.

Regla general de arbitraje: **el deck manda en el modelo de negocio** (qué se cobra, a
quién y cuánto); **los diseños mandan en el producto** (qué pantallas existen y qué
muestran). Cuando el deck simplifica un número que la app detalla, gana la app.

## D1 — Comisión: escalera 10 / 8 / 5

El deck cobra 10 % al cliente individual, 8 % a B2B estándar y 5 % a B2B empresarial. El
diseño web cobraba 12 / 8 / 5 por plan del proveedor. Coinciden en 8 y 5, así que la única
corrección es el primer escalón.

**Adoptado**: `Plan.commissionPct` = **10 / 8 / 5** para `basic` / `standard` / `enterprise`.
Los precios de suscripción del proveedor no cambian ($499 / $999 / $1,999): la app móvil los
confirma en N7 ("Suscripción · Estándar · $999/mes"), así que el plan del proveedor es real y
convive con el fee por transacción.

Cuando el cliente de una orden es una **cuenta corporativa** (D4), la comisión sale de la
cuenta corporativa y no del plan del proveedor:

```text
commissionPct = corporateAccount?.commissionPct ?? providerPlan.commissionPct
```

Como siempre, el porcentaje se **congela** en el `Payment` al momento del cobro.

## D2 — Quién paga el fee

El deck ejemplifica "proveedor cobra $1,000 · fee 10 % $100 · cliente paga $1,100", es decir
el fee montado encima del precio. La app móvil (C5) desglosa distinto: mano de obra $350 +
producto $189 + **tarifa de servicio $25** = $564, sin recargo porcentual visible al cliente.

**Adoptado**: la app manda porque es el contrato visible con el usuario.

- El **cliente** paga: precio del proveedor + `serviceFeeCents` (tarifa plana, hoy $25, vive
  en `PlatformSettings`).
- La **comisión** (D1) se descuenta del principal del proveedor: el transfer es
  `providerAmountCents − providerRefundedCents − commissionCents`. `amountCents` es el total
  cobrado al cliente e incluye `serviceFeeCentsApplied`; la tarifa plana nunca se transfiere
  al proveedor ni entra en la base porcentual (`XC-25`).
- El ejemplo del deck se lee como simplificación de pitch, no como regla de cobro.

## D3 — Bono de lealtad: 50 % del fee (programa anti-evasión)

El deck lo describe como el mecanismo central para que el proveedor no se salga de la
plataforma: se le devuelve el **50 % del fee** en vales de gasolina o despensa (deducibles)
o en transferencia directa. El diseño web decía "$150 por cada 50 órdenes" y la app muestra
un saldo de "Bonos de lealtad" en la wallet (N4).

**Adoptado**: el deck. Sustituye por completo al bono por volumen.

- `PlatformSettings.loyaltyBonusPct` (default **50**) reemplaza a los ajustes de
  `$150 / 50 órdenes`.
- Cada pago **liberado** devenga un bono: `bonusCents = round(commissionCents * pct / 100)`.
- El bono es un registro propio (D5), visible como saldo en la wallet del negocio y como
  línea **negativa** en el desglose de ingresos del admin (W12) — que es exactamente lo que
  el diseño de W12 pedía y no tenía fuente.
- Método de pago del bono: `VOUCHER` (vales) o `TRANSFER`. El admin lo liquida; no se mezcla
  con el saldo retirable de escrow.

Esto cierra los hallazgos `XC-06` y `F5-7`.

## D4 — Cuentas corporativas B2B: fase nueva (F7)

El deck vende membresías mensuales a **empresas que consumen** servicios (restaurantes,
hoteles, cadenas, clínicas, escuelas): $1,500 / $3,500 / $7,500 al mes según número de
sucursales, más una tarifa "a medida" arriba de 50. Nada de esto existe en el modelo actual,
donde `Business` es siempre un proveedor.

**Adoptado**: se modela como dominio propio y se planifica como **fase F7**, posterior a F5.
No entra en F0–F6, pero **sus llaves foráneas sí entran en la migración inicial** para no
partir la tabla `Order` después.

| Tier | Precio/mes | Sucursales | Comisión | Extras del deck |
|------|-----------|------------|----------|-----------------|
| `basic` | $1,500 | hasta 3 | 10 % | dashboard centralizado, facturación unificada |
| `standard` | $3,500 | 4–15 | 8 % | ejecutivo de cuenta, servicios recurrentes |
| `enterprise` | $7,500 | 16–50 | 5 % | SLA 2 h urgente, proveedores preferentes |
| `custom` | negociado | +50 | < 5 % | integración ERP/SAP, contrato a la medida |

## D5 — Huecos de modelo que sí entran en la migración inicial

De los huecos que reveló la app móvil (`07` §3), estos entran en `F0-03` porque tocan tablas
raíz y difieren mal:

| Modelo / campo | Por qué ahora |
|---|---|
| `Quote` (oferta de un negocio sobre una solicitud: precio, horario, trabajador, estado) | Cambia la raíz de `Order`; agregarlo después obliga a migrar órdenes existentes |
| `LoyaltyBonus` (monto, origen `Payment`, método, estado, pagado en) | D3 lo vuelve parte del modelo de ingresos desde el día 1 |
| `BusinessDocument` (tipo, URL, estado de verificación) | W10 ya muestra documentos y la app muestra "Verificación · Completo" |
| `Worker`: `branchId`, `specialty`, `availability`, `ratingAvg`, `invitedEmail`, `invitationStatus` | La tabla de W-team y N6 los muestran; son columnas, no tablas |
| `Order`: `recordingUrl`, `recordingDurationSec`, `beforeUrls`, `afterUrls`, `workNotes`, `materialsUsed` | Son la evidencia que el admin juzga en disputas (W11) |
| `Order.corporateAccountId` (nullable) | La llave de D4; F0 declara un `CorporateAccount` mínimo para que sea FK real y F7 amplía ese mismo modelo |

Quedan **fuera** de la migración inicial, documentados como futuros: mensajería por orden
(chat cliente↔negocio), publicidad y comisiones de ferreterías (fuente de ingresos 3 del
deck), y el marketplace de materiales.

## D6 — Grabación obligatoria como regla de resolución

Deck (§4) y app (T2) coinciden: la grabación del servicio es continua y obligatoria, y **su
ausencia o interrupción resuelve la disputa a favor del cliente**.

**Adoptado**: `resolveDispute` (F5) muestra el estado de la grabación en el expediente y,
cuando falta o está incompleta, la UI **preselecciona** `FULL_REFUND` y exige justificación
escrita para elegir cualquier otra resolución. La regla queda registrada en el expediente.

## D7 — Identidad visual: la landing usa la marca

El brandbook (slide 18) define Navy `#0D1B2A`, Gold `#C8A96E`, Cream `#F5F0E8`, White y
Gray `#8A9BB0`, con logo y taglines oficiales.

**Adoptado**, con frontera explícita:

- **Landing (W1)**: paleta de marca. Fondo cream/navy, acentos gold, tagline principal
  "El único lugar donde puedes dejar la llave de tu casa con total tranquilidad."
- **Dashboard y admin (W2–W13)**: paleta zinc de shadcn, sin cambios. Son herramientas de
  trabajo y el diseño las define así.
- Los tokens de marca se declaran como capa aparte en `globals.css`
  (`--brand-navy`, `--brand-gold`, `--brand-cream`, `--brand-gray`) y **solo** los consume la
  landing.

## D8 — Cifras públicas reales

La landing deja de inventar métricas. Fuentes citables del deck: 35 M de hogares en México,
~$350,000 M MXN de mercado anual, 95 % de informalidad, 500+ proveedores listos,
CONAPO 2025. El seed y la demo se ubican en **Chihuahua**, que es el mercado de arranque.

## D9 — Proveedores de notificaciones

Decidido por Roger:

- **Correo: Resend.** Lo usan la recuperación de contraseña (`F1-09`), la invitación de
  trabajadores (`F6-08`) y el alta de cuentas corporativas (`F7-03`). Vive detrás de
  `src/server/services/email/email-client.ts` como adaptador inyectable, para que ningún
  flujo dependa del SDK directamente.
- **SMS: send.dm.** Mismo patrón, en `src/server/services/sms/sms-client.ts`. Todavía no hay
  ningún flujo web que lo requiera —los avisos de orden y el seguimiento del técnico viven en
  la app móvil— pero el adaptador se declara aquí para que cuando llegue no se resuelva a las
  prisas con otro proveedor.

Variables de entorno: `RESEND_API_KEY`, `EMAIL_FROM`, `SENDDM_API_KEY`, `SMS_FROM`. Las de SMS
son opcionales mientras ningún flujo las use; el esquema de `env.js` debe permitirlo sin
romper el arranque.

Ningún adaptador se llama desde un componente ni desde un router: siempre a través de un
servicio de dominio, como el resto de integraciones externas.

## Contratos transversales de implementación

No agregan política nueva; hacen ejecutables D1–D4 sin reescribir historia:

- `XC-25`: ledger congelado de principal, tarifa, comisión y refunds. La distribución de la
  tarifa en refunds sigue bloqueada hasta decisión explícita de Roger.
- `XC-26`: pagos corporativos congelan tasa/monto efectivo y tasa/monto de referencia del
  plan proveedor; cambios futuros no alteran `savedByRateCents`.
- `XC-27`: W3/W6/W9/W12 proyectan ese ledger con las mismas bases y nombres. Espera las
  decisiones 1–3 de `PENDIENTES.md`; no fija estados elegibles por su cuenta.

## Qué cambia en el plan

| Fase | Cambio |
|------|--------|
| F0 | Schema: modelos y campos de D5; `Plan.commissionPct` 10/8/5; `loyaltyBonusPct` en settings; tokens de marca (D7); seed en Chihuahua |
| F3 | Ledger principal/tarifa de XC-25; comisión según D1 (incluye rama corporativa); devengo de bono al liberar (D3) |
| F4 | Planes con la nueva escalera; sin cambios de precio |
| F5 | Liquidación de bonos, proyección XC-27 en W12 y regla de grabación en disputas (D6) |
| F6 | Landing con marca y cifras reales (D7, D8) |
| **F7** | **Nueva**: cuentas corporativas B2B (D4), snapshot XC-26 y webhooks Billing propios |
