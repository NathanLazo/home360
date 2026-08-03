# [F7-06] Dashboard del cliente corporativo (`/corporate`)

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §6
- **Depende de**: `F7-05`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Interfaz principal que justifica la membresía; F7-07 cierra después la sincronización Stripe
y el recorrido integral. El valor que el cliente paga
es **visibilidad consolidada** de lo que gasta en todas sus ubicaciones, así que el resumen y
la tabla de órdenes son la pantalla, no un adorno.

Reutiliza por completo el sistema de F0 (`AppSidebar`, `KpiCard`, `DataTable`, `StatusBadge`,
`EmptyState`, `PageHeader`) y el patrón de módulo de F2. No introduce componentes compartidos
nuevos salvo que haya reuso real.

## Alcance

Crear en `src/app/[locale]/corporate/`:

```text
layout.tsx                        # sidebar claro + guarda de rol en servidor
page.tsx · loading.tsx · error.tsx
_components/
├─ corporate-overview.tsx         # orquesta KPIs + últimas órdenes
├─ corporate-kpi-row.tsx          # gasto del mes, órdenes activas, ubicaciones, ahorro
└─ recent-corporate-orders.tsx

orders/    page.tsx + _components/  (tabla consolidada, filtro por ubicación y estado,
                                     Sheet de detalle)
locations/ page.tsx + _components/  (tabla, Sheet de alta/edición, ConfirmDialog de baja,
                                     aviso de límite por tier)
membership/ page.tsx + _components/ (tier actual, uso vs. límite, facturas, diálogo de
                                     solicitud de cambio)
```

Crear `src/messages/es/corporate.json` y `src/messages/en/corporate.json` y registrarlos en el
cargador de mensajes si este usa imports explícitos. Modificar `src/middleware.ts` para
proteger `/corporate/*` por rol con el patrón locale-aware de `F1-05`. `homeForRole` ya fue
ampliado en F7-02: reutilizarlo, no crear otro mapa.

## Detalle técnico

- **Guarda de rol** en `layout.tsx` (servidor), igual que `F1-06`: sesión sin rol
  `CORPORATE` → redirect a su home por rol. Sin sesión → login con callback y locale;
  rol distinto → su home. El middleware es cortesía de UX y el layout la barrera de render;
  la autorización de datos sigue en tRPC.
- **KPI de ahorro**: se muestra solo si `savedByRateCents > 0`, con el texto explicando de
  dónde sale ("comisión preferente de tu plan Estándar"). Presumir un ahorro de $0 sería peor
  que no mostrarlo.
- **Tabla de órdenes**: el filtro por ubicación vive en `?location=<id>` (mismo patrón de
  searchParams que el selector de sucursal de F2-01), para que la vista sea compartible y
  sobreviva a un refresh. Estado, cursor y mes también se serializan; valores inválidos se
  normalizan sin lanzar en render.
- **Ubicaciones**: cuando se alcanza `maxLocations`, el botón de alta se deshabilita con
  tooltip que nombra el límite y ofrece el enlace a `membership` — el upsell honesto, no un
  error críptico.
- **Membresía**: tier, cuota mensual, renovación y barra de uso de ubicaciones. El diálogo de
  cambio deja claro que es una **solicitud** que revisa el equipo, no un cambio inmediato
  (F7-05). Muestra el estado de solicitud pendiente y evita duplicarla.
- **Facturas**: lista paginada de la membresía corporativa con monto, fecha, estado y PDF.
  Abre `pdfUrl` en pestaña nueva con `rel="noopener noreferrer"`; si es `null`, el botón queda
  deshabilitado con tooltip traducido. El copy explica que una sola factura de membresía
  cubre la cuenta y todas sus ubicaciones; no promete CFDI ni facturación fiscal.
- **Estado no activo**: `PENDING`, `SUSPENDED` y `CANCELLED` pueden leer overview/historial/
  membresía, pero la UI oculta o deshabilita mutaciones conforme al backend. Suspensión
  muestra `statusReason` sin exponer detalles internos que el router no seleccione.
- Estados de carga con skeletons fieles; errores con retry; vacíos con CTA.
- Paleta zinc, sin animaciones: es una herramienta de trabajo, no la landing.
- Componentes cliente consumen `result` solo después de verificar el envelope; errores se
  resuelven por código estable contra `errors.json`/`corporate.json`, nunca mostrando
  `message` crudo.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; errores traducidos desde el código, no desde
  `message`.
- Lecturas con `corporateProcedure`, mutaciones con `activeCorporateProcedure`.
- TypeScript estricto: sin `any`; tipos inferidos de tRPC.
- Identificadores, rutas y carpetas en inglés; **todo** el copy vía next-intl (es/en).
- Dinero en centavos; formateo solo en UI, con `tabular-nums` en montos.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- Server Components por defecto; `"use client"` solo en filtros, sheets y diálogos.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] Un usuario BUSINESS, CUSTOMER o ADMIN no puede entrar a `/corporate` (middleware +
      layout).
- [ ] Login y redirects conservan `/en` y callback; CORPORATE aterriza en `/corporate`.
- [ ] La tabla consolidada muestra órdenes de todas las ubicaciones y el filtro sobrevive a
      un refresh.
- [ ] Alcanzar el límite de ubicaciones bloquea el alta con explicación, no con error.
- [ ] Ningún string hardcodeado; ambos locales completos; navegación por teclado completa.
- [ ] PDFs se abren de forma segura; factura sin PDF tiene acción deshabilitada y explicada.
- [ ] Cuenta suspendida/cancelada no puede disparar mutaciones aunque manipule la UI.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
