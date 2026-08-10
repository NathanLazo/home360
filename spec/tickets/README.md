# Tickets de implementación — HOME360

116 tickets de implementación autocontenidos: 107 de fase (F0–F7) y 9 transversales (XC),
derivados de las specs `spec/00-foundations.md` … `spec/09-corporate-accounts.md`.
Cada uno está pensado para que **un agente lo implemente sin leer los demás**: incluye contexto,
alcance de archivos, detalle técnico, restricciones no negociables y criterios de aceptación.

## Cómo usar esta carpeta

1. Se toma el ticket de menor número cuyas dependencias estén cerradas.
2. Se implementa **solo** lo que dice su sección *Alcance*; lo que sobra se anota, no se hace.
3. Se cierra con sus *Criterios de aceptación* verdes: `pnpm typecheck`, `pnpm check` y
   `pnpm build`.
4. Los comandos de BD y Stripe listados al final de cada ticket **los ejecuta Roger**; el agente
   solo puede correr `pnpm prisma generate`.

**El proyecto no lleva pruebas automatizadas.** No se instala vitest ni se escriben archivos
`*.test.ts`. Las secciones "Pruebas" que quedan en las specs `00`–`06` están anuladas por la
sección *Restricciones no negociables* de cada ticket, que lo dice explícitamente. La única
verificación funcional es `pnpm build` más el recorrido manual de `F6-18`.

`_TEMPLATE.md` es la plantilla; los archivos `*-findings.md` son hallazgos de revisión, no trabajo.

## Decisiones ya tomadas

[`spec/08-business-model-alignment.md`](../08-business-model-alignment.md) es **normativo** y
resuelve la alineación con el deck de socios: comisión 10 / 8 / 5, tarifa de servicio plana al
cliente con la comisión descontada del payout, bono de lealtad = 50 % del fee (sustituye al
bono por volumen), cuentas corporativas B2B como fase **F7**, los modelos que la app móvil
reveló y que entran en la migración inicial, la regla de "sin grabación → reembolso al
cliente", y la paleta de marca limitada a la landing. Ante cualquier contradicción con las
specs `00`–`06`, manda ese documento.

También está resuelto el **inventario por sucursal**: `ProductStock` (producto × sucursal)
con stock y umbral propios; `Product` conserva solo el catálogo (SKU, nombre, precio,
categoría, estado). Los servicios **no** llevan relación con sucursal: su cobertura se deriva
del radio de la sucursal y de los trabajadores asignados. Ver `F0-12` y `F2-07`…`F2-09`.

## Antes de escribir código: estado de decisiones

Las decisiones cerradas sobre pagos viven en [`PENDIENTES.md`](../../PENDIENTES.md), en la
raíz del repo, como contrato normativo. La tabla conserva además gates independientes que
siguen abiertos para fases posteriores.

La tabla de abajo es el detalle técnico de las mismas, más lo ya resuelto.

| # | Decisión | Dónde |
|---|----------|-------|
| 1 | ~~Fórmula de Disponible~~ — **resuelto**: neta XC-03 e incluye `PARTIALLY_REFUNDED` | `XC-03`, `F3-F4-findings` #2 |
| 2 | ~~Comisión en reembolso parcial~~ — **resuelto**: proporcional al principal retenido | `XC-03`, `F3-05`, `F5-07` |
| 3 | ~~Retiros~~ — **resuelto**: solicitud manual y aprobación mediante `Payout` | `XC-08`, `F3-02`, `F3-07`, `F5-11` |
| 4 | Cobro de la suscripción: no existe recolección de método de pago (sin Portal/Elements nunca cobra) | `F3-F4-findings` #13 |
| 5 | Onboarding Connect: quitar la "cuenta placeholder" de `approveBusiness` o cambiar la condición del banner | `F5-findings` F5-1 |
| 6 | ~~Refund de tarifa plana~~ — **resuelto**: total devuelve toda; parcial solo la porción explícita autorizada | `XC-25`, `F3-05` |
| 7 | ~~API de links de cobro~~ — **resuelto**: Payment Links persistente y single-use | `F3-08` |
| 8 | ~~Pago ya liberado~~ — **resuelto para F3**: rechazar; Transfer Reversal queda en ticket separado | `F3-05`, `F3-09` |
| 9 | ~~Cuenta sin suscripción al capturar~~ — **resuelto**: rechazar con `BUSINESS_NOT_ACTIVE` | `F3-03` |
| 10 | Huso horario canónico de mes financiero (fuera de F7, que ya fija Chihuahua) | `F3-06`, `XC-27` |
| 11 | Tratamiento fiscal de precios de suscripción (IVA/CFDI) antes de publicar Price | `F4-01` |
| 12 | Cambio de Price para suscriptores vivos: conservar o migrar en renovación | `F4-01` |
| 13 | Retención/anonimización de facturas al eliminar un negocio | `F4-01` |
| 14 | Settings admin: bootstrap del singleton, catálogo IA y rangos definitivos | `F5-13` |
| 15 | ~~Documentos de garantía y bonos de lealtad sin modelo fuente~~ — **resuelto** por D3 y D5 | `08` D3, D5 |
| 16 | ~~Catálogo/stock por sucursal~~ — **resuelto**: inventario por sucursal (`ProductStock`), catálogo y servicios a nivel negocio | `F0-12`, `F2-01`, `F2-07`…`F2-09` |
| 17 | ~~Modelo de ingresos deck vs. diseño web~~ — **resuelto** por D1–D4 | `08` D1–D4 |
| 18 | ~~Paleta de marca vs. zinc~~ — **resuelto** por D7 (marca en landing, zinc en dashboard/admin) | `08` D7 |

Las filas 1–3 y 6–9 están cerradas en `PENDIENTES.md`. Las filas 4–5 y 10–14 siguen siendo
gates independientes; Transfer Reversal permanece fuera de F3 y requiere ticket propio.

## Orden global de ejecución

El grafo real de dependencias corrige el mapa del README de specs en dos puntos:
**F5 depende de F3 y F4** (aprobar un negocio crea su suscripción Stripe) y **F6 depende de F2**
(reusa el patrón de módulo y `assertPlanLimit`). Por eso F6 se parte en dos tramos.

```text
F0 ──▶ F1 ──▶ F2 ──┬──▶ F3 ──▶ F4 ──▶ F5 ──┬──▶ F6b (calidad y cierre)
                   │                       └──▶ F7 (cuentas corporativas B2B)
                   └──▶ F6a (landing, team, settings)
```

Orden transversal obligatorio:

```text
F0-12 ─▶ XC-25 ─▶ F0-14 / F3-01…05 / F3-08
F3-01… + decisiones refunds/retiros ─▶ XC-27 (después de F2-04, F3-12 y F5-12)
F7-01 + F3-03 + XC-25 ─▶ XC-26 ─▶ F7-03 ─▶ F7-05/F7-07
decisión retiro ─▶ XC-08 ─▶ F3-07 ─▶ F5-11/F5-12
```

| Fase | Tickets | Entregable |
|------|---------|------------|
| **F0** Fundaciones | F0-01 … F0-14 | Scaffold, schema, contrato, i18n, adaptadores de notificación y seed base/transaccional |
| **F1** Auth | F1-01 … F1-12 | Credentials + Google, registro, guardas, recuperación completa, sign-out y rate limiting |
| **F2** Dashboard negocio | F2-01 … F2-14 | W3–W5/W8, órdenes y registro centralizado de routers |
| **F3** Pagos | F3-01 … F3-13 | Connect, escrow, links de cobro, retiros, webhooks, cron, W6 |
| **F4** Suscripciones | F4-01 … F4-12 | Billing, límites, facturas, degradación y estado cancelado de solo lectura |
| **F5** Admin | F5-01 … F5-17 | W9–W13, bonos y auditoría de acciones administrativas |
| **F6a** Landing y módulos | F6-01 … F6-11 | W1 con Magic UI, team, settings de negocio |
| **F6b** Cierre | F6-12 … F6-18 | Barridos de estados, a11y, i18n, responsive, tipografía, build y recorrido manual |
| **F7** Corporativo B2B | F7-01 … F7-07 | Cuentas/ubicaciones, membresía, snapshot de comisión, dashboard y webhooks Billing |
| **XC** Transversales | XC-01, 03, 05, 08, 11, 13, 25, 26, 27 | Schema, dinero, retiros, snapshots y proyecciones; se ejecutan en el punto del grafo indicado, no todas dentro de F0 |

## Paralelización

Dentro de una fase, los tickets de *router/servicio* y los de *UI* del mismo módulo son
secuenciales. Los módulos pueden avanzar en paralelo solo cuando no reclaman un archivo
compartido; `src/server/api/root.ts`, agregadores `admin/index.ts`, layouts y JSON de mensajes
son puntos de merge serial, aunque las carpetas privadas se trabajen en paralelo.

- F0: `F0-03` (schema) ∥ `F0-06` (shadcn) ∥ `F0-10` (env/Stripe).
- F2: la cadena de servicios (`F2-05/06`) ∥ productos (`F2-07/08/09`) ∥ sucursales (`F2-10/11`).
- F3: los servicios `F3-02` … `F3-08` tras `F3-01`.
- F5: usuarios, disputas, finanzas y settings pueden trabajar sus archivos privados en
  paralelo; el registro en `admin/index.ts` se integra en orden F5-03 → F5-08 → F5-13.
- F6b: los barridos comparten casi toda la UI y se ejecutan en cadena
  `F6-12 → F6-13 → F6-14 → F6-15 → F6-16`.

## Hallazgos de revisión

| Archivo | Contenido |
|---------|-----------|
| `XC-findings.md` | 24 hallazgos transversales (schema vs. consumo, contratos entre fases, códigos de error, estados, dinero, i18n, dependencias, paquetes) |
| `F0-findings.md` | 5 decisiones abiertas de fundaciones |
| `F1-findings.md` | 8 hallazgos de auth (recuperación de contraseña, OAuth linking, rate limiting, sign-out) |
| `F2-findings.md` | 6 abiertos + 19 problemas resueltos en tickets |
| `F3-F4-findings.md` | 24 hallazgos de dinero (3 bloqueantes) |
| `F5-findings.md` | 20 hallazgos de admin (2 bloqueantes) |
| `F6-findings.md` | 23 hallazgos de landing y calidad (0 bloqueantes) |
