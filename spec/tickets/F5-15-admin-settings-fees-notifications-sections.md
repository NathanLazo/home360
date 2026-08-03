# [F5-15] Completar W13: secciones de tarifas (comisiones por plan) y notificaciones

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §5 (`fees-settings-section.tsx`, `notifications-settings-section.tsx`, `updatePlanCommissions`)
- **Depende de**: `F5-14`
- **Tamaño estimado**: M (1–3 h)
- **Estado**: bloqueado transitivamente hasta que F5-13 tenga rangos aprobados.

## Contexto

Últimas dos secciones del formulario de W13. La de **tarifas** es la única que escribe
fuera del singleton (comisiones por plan → `updatePlanCommissions`), y la de
**notificaciones** es la que el diseño resuelve con switches y radios. El submit único, la
barra sticky y las mutations ya existen (F5-14): este ticket solo agrega componentes de
sección, sus claves i18n y el copy de advertencia.

**Problemas detectados y resolución**:

1. Los radios del diseño no tienen opciones ni rangos aprobados. `5 / 10 / 25 / 50 km` y
   `12 / 24 / 48 h` eran propuestas no normativas. **Bloqueo**: Roger debe confirmar
   rangos y opciones en F5-13. Cuando exista un valor persistido válido fuera de las
   opciones visuales, el componente lo agrega dinámicamente para no perderlo ni forzar
   un cambio silencioso.
2. "afecta solo pagos futuros" (spec §5) es una promesa que la UI debe hacer visible:
   **Resolución**: nota permanente en la sección de tarifas explicando que la comisión se
   congela en cada pago y que los pagos históricos no cambian (invariante verificable por
   inspección manual).
3. La spec no dice qué pasa si el admin cambia solo una comisión: `updatePlanCommissions`
   exige los 3 valores. **Resolución** (ya contratada en F5-14): la mutation se envía con
   los 3 valores actuales del formulario cuando cualquiera está sucio.

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/settings/_components/fees-settings-section.tsx`.
- `src/app/[locale]/admin/settings/_components/notifications-settings-section.tsx`.
- `src/app/[locale]/admin/settings/_components/settings-view.tsx` — montar ambas secciones
  en el orden del diseño (IA → Tarifas → Escrow → Notificaciones).
- `src/messages/{es,en}/admin.json` — claves `settings.fees.*` y `settings.notifications.*`.

Fuera de alcance: router/servicio (F5-13); infraestructura del formulario y mutations
(F5-14); envío real de notificaciones (ninguna fase lo implementa — ver `F5-findings.md`).

## Detalle técnico

### `fees-settings-section.tsx`

Recibe el `form` de RHF por prop (mismo patrón que las secciones de F5-14) y se renderiza
dentro de `settings-section-card`.

- **Comisiones por plan**: 3 `Input type="number"` (`commissionBasic`, `commissionStandard`,
  `commissionEnterprise`), sufijo "%", rango 0–30, etiquetados con el nombre del plan
  traducido por `code` (Básico / Estándar / Empresarial — nunca `Plan.name` de BD, que no
  se traduce). Grid de 3 columnas en desktop, apilado en móvil.
- **Nota de alcance** (traducida, con icono `Info` y `role="note"`): "Los cambios aplican
  solo a pagos futuros: cada pago congela su comisión al cobrarse".
- **Tarifa de servicio al cliente**: `Input` en **pesos** con prefijo "$" y el rango que
  Roger apruebe en F5-13, mapeado
  a `customerServiceFeeCents` en `settings.mappers.ts` (F5-14).
- **Bono de lealtad** (D3): un solo `Input` con sufijo "%" para `loyaltyBonusPct` (0–100,
  default 50), acompañado de una nota traducida que explique el programa: se devuelve ese
  porcentaje de la comisión al negocio, en vales o transferencia, cuando el pago se libera.
  Ayuda a dimensionarlo mostrar el efecto con un ejemplo calculado en vivo ("con 50 %, de
  una comisión de $100 el negocio recibe $50").
- Todos los montos se muestran formateados en MXN al perder el foco; el valor editable es
  numérico plano (sin máscara custom).

### `notifications-settings-section.tsx`

- **Radio de nuevas solicitudes**: `RadioGroup` horizontal con las opciones aprobadas
  (+ opción dinámica del Contexto §1); label y unidades traducidas.
- **Aviso de liberación de pago**: `Switch` `notifyPaymentRelease` con descripción.
- **Recordatorio de calificación**: `RadioGroup` con las opciones aprobadas sobre
  `notifyRatingReminderHours` (+ opción dinámica).
- Cada `RadioGroup` con `aria-labelledby` apuntando al label del grupo; los `RadioGroupItem`
  con `id` propio y `<Label htmlFor>`.

### Integración

- `settings-view.tsx` pasa `form` a las 4 secciones; ningún componente de sección llama a
  tRPC ni conoce las mutations (todo pasa por la barra sticky de F5-14).
- Marcar cualquier campo de estas secciones deja el formulario sucio y activa la misma
  barra "Guardar cambios"; el conteo de cambios ya es genérico.
- Componentes shadcn requeridos: `radio-group`, `switch` (instalación cubierta por `XC-13`).
- Los valores de notificación son configuración para consumidores de la app móvil futura;
  este ticket no implementa envíos ni promete efectos visibles en la web.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- UI → cliente tRPC; los rangos vienen del schema compartido (F5-13), no se re-declaran.
- Toda respuesta consumida conserva `{ result, error, status, message }`
  (`TrpcResponse`); la UI valida el envelope antes de leer `result`.
- TypeScript estricto: sin `any`; los valores de los radios son constantes tipadas
  (`as const`), no strings sueltos.
- Identificadores y carpetas en inglés; TODO el copy vía next-intl (es/en), incluidos
  nombres de plan, unidades (km, h) y la nota de "solo pagos futuros".
- Dinero en centavos en el wire; conversión pesos↔centavos solo en `settings.mappers.ts`.
- Componentización máxima: una sección = un archivo, en `_components/`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Las 4 secciones se ven en el orden del diseño con un único botón "Guardar cambios".
- [ ] Partiendo del default normativo 10/8/5, cambiar una comisión actualiza los tres
      valores de forma atómica y ningún pago histórico cambia su comisión (verificable en
      W12: las comisiones del mes no se mueven).
- [ ] Cambiar tarifa de servicio a $30 y el bono a 40 % → la tarifa persiste como
      `3000` centavos y el bono como entero `40`; ambos se releen tras recargar.
- [ ] Radios y switches reflejan el valor persistido; un valor fuera del catálogo (p. ej.
      15 km) aparece como opción extra seleccionada.
- [ ] es/en completos; secciones operables por teclado con labels asociados.

## Comandos para Roger (si aplica)

No aplica. Verificación manual sugerida (spec §7): cambiar el umbral IA a 90 y la comisión
`standard` a 7, recargar `/admin` y `/admin/settings` y confirmar que ambos persisten.
