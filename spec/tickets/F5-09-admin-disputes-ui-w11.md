# [F5-09] Implementar UI de W11 — Disputas master-detail `/admin/disputes`

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §3 (módulo), §7 (verificación manual)
- **Depende de**: `F5-08`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: bloqueado transitivamente para habilitar resoluciones monetarias mientras
  `F5-07` esté bloqueado. La vista de expediente puede construirse en modo lectura.

## Contexto

Pantalla master-detail: lista de disputas a la izquierda, expediente a la derecha, con
resolución de escrow mediante los 4 botones del diseño. La selección vive en
`?dispute=<id>` (deep-linkeable desde W9 y desde el sheet de W10).

**Decisiones (huecos de spec resueltos)**:

1. Sin `?dispute=` en la URL se auto-selecciona la primera disputa abierta (si existe);
   id inexistente → panel derecho con empty-state de error NOT_FOUND traducido (la lista
   sigue funcionando).
2. La duración de la grabación no está en BD (ver F5-08): el player la obtiene de
   `onLoadedMetadata` del `<video>`.
3. El input de monto parcial se captura en **pesos MXN** (UX del diseño) y se convierte a
   centavos en el submit (`Math.round(value * 100)`); el server revalida.

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/disputes/page.tsx` · `loading.tsx` · `error.tsx`.
- `src/app/[locale]/admin/disputes/_components/`:
  `disputes-view.tsx`, `dispute-list.tsx`, `dispute-list-item.tsx`, `dispute-detail.tsx`,
  `dispute-recording-player.tsx`, `dispute-evidence-grid.tsx`, `dispute-arguments.tsx`,
  `dispute-ai-summary.tsx`, `dispute-resolution-actions.tsx`,
  `resolve-dispute-dialog.tsx`, `use-dispute-mutations.ts`.
- `src/messages/{es,en}/admin.json` — sección `disputes`.

Fuera de alcance: router (F5-08), servicio (F5-07), notificaciones a las partes.

## Detalle técnico

- `disputes-view.tsx`: split 1/3–2/3 en desktop; en móvil la lista ocupa todo y
  seleccionar navega al detalle (mismo componente, breakpoint con clases Tailwind; botón
  "volver" que limpia `?dispute=`). Tabs/filtro Abiertas (`openCount`) / Resueltas
  (`resolvedThisMonth` como subtítulo). Selección: `router.replace` con
  `?dispute=<id>` (scroll intacto, sin recarga).
- `dispute-list.tsx`: consume `nextCursor` con "Cargar más"; conserva filtro y selección
  en URL, sin volver a cargar todo el histórico.
- `dispute-list-item.tsx`: título, folio de orden (Geist Mono), partes, monto, badge de
  urgencia/estado — Urgente (rojo, `URGENT` abierta), En revisión (ámbar,
  `IN_REVIEW`/`OPEN` normal), Resuelta (gris). Item activo resaltado.
- `dispute-detail.tsx` (orquesta con `getById`):
  - `dispute-recording-player.tsx`: `<video controls>` con `recordingUrl`; duración vía
    metadata. **Sin grabación o con `recordingComplete === false`**: en lugar de un
    empty-state neutro, un `Alert` destacado que explique la regla D6 — la grabación es
    obligatoria e ininterrumpida, y su ausencia resuelve la disputa a favor del cliente.
    Es la pieza de información más determinante del expediente, así que va arriba, no al
    final.
  - `dispute-evidence-grid.tsx`: miniaturas (máx. 4 visibles + celda "+N" que expande).
  - `dispute-arguments.tsx`: bloques citados CLIENTE / NEGOCIO (businessArgument nulo →
    "El negocio aún no responde").
  - `dispute-ai-summary.tsx`: card destacada (borde/acento) con `aiSummary`; nulo → no
    se renderiza.
  - Resumen del pago: monto en escrow, comisión, estado (`payment-status` textual).
- `dispute-resolution-actions.tsx`: 4 botones (Reembolso total / Reembolso parcial /
  Liberar pago / Pedir más evidencia) — deshabilitados si `status === RESOLVED` o si
  `payment?.status !== "IN_ESCROW"` (para los 3 monetarios), con tooltip del motivo.
  Cuando falta la grabación (D6), "Reembolso total" queda como acción **primaria** y las
  demás como secundarias: la UI empuja hacia la resolución por defecto sin bloquear el
  criterio del admin.
  Mientras `F5-07` esté bloqueado, las acciones monetarias no se muestran como operativas;
  la UI no simula una política de refund.
- `resolve-dispute-dialog.tsx`: `AlertDialog` por resolución con **resumen del efecto
  monetario** calculado solo para display desde `payment` (ej. parcial: "Se reembolsarán
  $X al cliente y se liberarán $Y − comisión al negocio"); input de monto solo en
  parcial, validado client-side (0 < monto < total, neto > 0 — mismo schema Zod del
  módulo). Si falta la grabación y la resolución elegida **no** es reembolso total, el
  diálogo suma un `Textarea` de justificación obligatoria (mínimo ~20 caracteres) que viaja
  como `justification`; el servidor lo revalida con
  `RECORDING_JUSTIFICATION_REQUIRED` (F5-07). Confirmar → `admin.disputes.resolve`.
- `use-dispute-mutations.ts`: mutation con toasts por código de error
  (incluye el código específico que F3 defina para el límite del parcial,
  `RECORDING_JUSTIFICATION_REQUIRED`, `CONFLICT`, `STRIPE_ERROR`) e invalidación de
  `admin.disputes.list`, `getById` y `admin.overview.*` (badge del sidebar incluido).

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- UI → cliente tRPC; ningún cálculo de dinero autoritativo en cliente (el resumen del
  dialog es informativo; el server revalida todo).
- Toda respuesta consumida conserva `{ result, error, status, message }`
  (`TrpcResponse`); la UI valida el envelope antes de leer `result`.
- TypeScript estricto: sin `any`; tipos desde `disputes.types.ts`.
- Identificadores en inglés; TODO el copy vía next-intl (es/en).
- Dinero en centavos en el wire; conversión pesos↔centavos solo en este módulo de UI.
- Componentización máxima; nada importado desde `_components` de otros módulos.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] `/admin/disputes?dispute=<id>` (desde W9) abre el expediente correcto; URL inválida
      muestra empty-state sin romper la lista.
- [ ] Solo después de cerrar `PENDIENTES.md` §1–§2: resolver una disputa creada con
      PaymentIntent test real mediante reembolso parcial; el monto y código coinciden con
      F3, la disputa pasa a Resueltas y el badge decrementa. No usar filas seed sin objetos
      Stripe.
- [ ] Botones monetarios deshabilitados en disputas resueltas o sin pago en escrow.
- [ ] Layout responsive: master-detail en desktop, lista→detalle en móvil; es/en completos.
- [ ] La lista pagina de 20 en 20 y mantiene `?dispute=` al cargar más.

## Comandos para Roger (si aplica)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

(para observar el Refund/Transfer del flujo manual en test-mode).
