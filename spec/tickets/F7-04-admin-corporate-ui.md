# [F7-04] UI de administración de cuentas corporativas (`/admin/corporate`)

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §6
- **Depende de**: `F7-03`
- **Tamaño estimado**: L (3–6 h)

## Contexto

Pantalla de administración de la segunda fuente de ingresos. No existe en el diseño
`HOME360 Web.dc.html` — es producto nuevo derivado del deck — así que sigue el sistema ya
establecido en W10/W12 (sidebar oscuro, tabla con tabs, Sheet de detalle, AlertDialog para
acciones destructivas) en vez de inventar un lenguaje visual propio.

## Alcance

Crear en `src/app/[locale]/admin/corporate/`:

```text
page.tsx · loading.tsx · error.tsx  +  _components/
├─ corporate-view.tsx              # tabs por estado + filtros
├─ corporate-filters.tsx           # búsqueda + Select de tier y estado
├─ corporate-accounts-table.tsx    # nombre, tier, ubicaciones, gasto del mes, estado
├─ corporate-row-actions.tsx       # DropdownMenu contextual por estado
├─ corporate-detail-sheet.tsx      # términos, ubicaciones, órdenes, membresía
├─ create-corporate-dialog.tsx     # alta con invitación por correo
├─ corporate-terms-form.tsx        # tier, comisión, cuota, límite de ubicaciones
├─ suspend-corporate-dialog.tsx    # AlertDialog con razón obligatoria
├─ reactivate-corporate-dialog.tsx # confirma reanudación del cobro
├─ corporate-tier-requests.tsx     # solicitudes pendientes; aprobar/rechazar
├─ corporate-tier-badge.tsx
├─ corporate.schema.ts · corporate.types.ts
└─ use-corporate-mutations.ts
```

Modificar: `src/app/[locale]/admin/_components/app-sidebar-admin.tsx` (entrada nueva),
`src/messages/{es,en}/admin.json`.

Fuera de alcance: dashboard del cliente corporativo (F7-06).

## Detalle técnico

- **Tabla**: tabs `Todas` / `Activas` / `Pendientes` / `Suspendidas` / `Canceladas` con
  conteos, igual que W10. Búsqueda, tier, estado y cursor viven en search params para que no
  se pierdan al refrescar. No cargar todas las cuentas para paginar/filtrar en cliente.
  Columna de gasto del mes con `tabular-nums` y formato MXN desde centavos.
- **`corporate-terms-form.tsx`** es la pieza delicada. Muestra el efecto económico **antes**
  de guardar, porque la comisión preferente tiene un efecto compuesto que no es obvio:
  al bajar la comisión, el ingreso de plataforma baja **y** el bono de lealtad del proveedor
  (50 % de esa comisión, D3) baja con ella. Un ejemplo calculado en vivo sobre un ticket de
  $1,500 evita negociar a ciegas:

  ```text
  Comisión 8 %  →  fee $120  ·  bono al proveedor $60  ·  neto plataforma $60
  Comisión 3 %  →  fee $45   ·  bono al proveedor $22  ·  neto plataforma $23
  ```

- **Nota de alcance persistente** (`role="note"`): "Los términos aplican solo a órdenes
  futuras: cada pago congela su comisión al cobrarse".
- **Alta**: el diálogo pide correo del responsable y deja claro que se envía invitación; no
  hay campo de contraseña en ninguna parte de la UI. También permite ejecutivo de cuenta;
  los defaults de cuota/comisión/límite vienen del tier seleccionado y `CUSTOM` obliga a
  capturarlos. Los errores `EMAIL_TAKEN`, `EMAIL_DELIVERY_FAILED`, `PLAN_NOT_SYNCED`,
  `VALIDATION_ERROR` y `STRIPE_ERROR` se traducen por código.
- **Activación**: `ConfirmDialog` que resume tier, cuota mensual y comisión antes de crear la
  suscripción en Stripe.
- **Suspensión/reactivación**: suspender exige una razón no vacía y advierte que pausa el
  acceso y el cobro; reactivar confirma que reanuda ambos. `CANCELLED` es solo lectura y no
  ofrece reactivación.
- **Solicitudes de tier**: el Sheet muestra las `PENDING` con tier, notas y fecha. Aprobar
  abre el formulario de términos y envía `requestId`; rechazar exige nota. La UI nunca cambia
  el tier por su cuenta.
- `corporate.schema.ts` reutiliza/infiere los schemas Zod exportados por el router cuando el
  patrón del repo lo permita; no mantiene un segundo contrato manual. `corporate.types.ts`
  deriva tipos con `RouterOutputs`/`RouterInputs`, sin interfaces copiadas ni `any`.
- Toda mutation invalida exactamente los queries afectados (`list`, `getById` y conteos);
  no hace optimistic update en activación, suspensión o términos porque Stripe puede fallar.
- Estados de carga con skeletons fieles al layout final; `EmptyState` con CTA de alta.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; errores traducidos desde el código, nunca desde
  `message`.
- Todo el namespace admin con `adminProcedure`.
- TypeScript estricto: sin `any`; tipos inferidos de tRPC.
- Identificadores, rutas y carpetas en inglés; **todo** el copy vía next-intl (es/en).
- Dinero en centavos; formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- Paleta zinc: la marca (navy/gold) es exclusiva de la landing (D7).
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] Alta, activación, cambio de términos y suspensión operativos de punta a punta.
- [ ] Reactivación reanuda el cobro; cuentas canceladas no muestran acciones inválidas.
- [ ] Las solicitudes de tier se pueden revisar sin que la UI autoasigne términos.
- [ ] El formulario de términos muestra el efecto sobre fee, bono y neto antes de guardar.
- [ ] Paginación y filtros son server-side y sobreviven a refresh.
- [ ] Ningún string hardcodeado; ambos locales completos.
- [ ] Navegación por teclado completa en tabs, sheet y diálogos; foco visible.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
