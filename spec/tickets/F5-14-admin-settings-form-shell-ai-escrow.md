# [F5-14] Construir el formulario de W13: shell, submit único sticky y secciones IA + escrow

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §5 (módulo `settings/`), `spec/00-foundations.md` §7 (page-header, tokens)
- **Depende de**: `F5-13`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: bloqueado transitivamente hasta cerrar catálogo/rangos/bootstrap de F5-13.

## Contexto

W13 es **un solo formulario** dividido en `Card`s por grupo con un único botón "Guardar
cambios" sticky habilitado por dirty-state (spec §5). Este ticket monta toda la
infraestructura del formulario (react-hook-form + zodResolver, mapeo wire↔form, barra
sticky, mutations) y las dos secciones más simples: **IA** y **escrow**. Las secciones de
tarifas y notificaciones llegan en `F5-15` sin cambiar el contrato del submit.

**Problemas detectados y resolución**:

1. La spec pide "submit único" pero separa dos mutations. Dos llamadas secuenciales pueden
   aplicar settings y fallar comisiones, violando la expectativa del formulario.
   **Resolución**: el único `handleSubmit` llama `admin.settings.save` de F5-13 con campos
   sucios, las tres comisiones cuando alguna cambió y `expectedUpdatedAt`. El servidor
   aplica todo o nada en una transacción; `SETTINGS_STALE` obliga a refetch y confirmación,
   nunca sobreescribe silenciosamente cambios de otro admin.
2. El schema del formulario debe existir **completo** desde este ticket (todos los campos
   vigentes del singleton + 3 comisiones), aunque las secciones de tarifas y notificaciones aún no
   se rendericen: así `F5-15` solo agrega componentes de sección y claves i18n, sin tocar
   el submit. Documentado con comentario en `settings.form.ts`.
3. Dinero: la UI captura la tarifa de servicio en pesos y el wire es centavos.
   **Resolución**: los mapeos viven en
   `settings.mappers.ts` (funciones puras `toFormValues` / `toUpdateInput`), no dispersos
   en componentes; el server revalida siempre (F5-13).

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/settings/page.tsx` · `loading.tsx` · `error.tsx`.
- `src/app/[locale]/admin/settings/_components/`:
  `settings-view.tsx`, `settings-section-card.tsx`, `settings-save-bar.tsx`,
  `ai-settings-section.tsx`, `escrow-settings-section.tsx`, `settings.form.ts`,
  `settings.mappers.ts`, `use-settings-mutations.ts`.
- `src/messages/{es,en}/admin.json` — sección `settings` (título, descripciones de sección,
  labels y helper texts de IA y escrow, barra de guardado).

Fuera de alcance: `fees-settings-section.tsx` y `notifications-settings-section.tsx`
(F5-15); router y servicio (F5-13); consumo real de los valores por la IA o el cron.

## Detalle técnico

### Formulario

`settings.form.ts` (junto al `settings.schema.ts` de F5-13, que sigue siendo la fuente de
rangos del wire):

```text
export const settingsFormSchema = z.object({
  // IA
  aiConfidenceThresholdPct: z.number().int().min(50).max(99),
  aiPriceMarginPct: z.number().int().min(5).max(50),
  aiPricingModel: z.enum(AI_PRICING_MODELS),
  aiHumanReviewBelowThreshold: z.boolean(),
  // Tarifas (UI en pesos; render en F5-15)
  customerServiceFee: /* conversión en pesos del rango aprobado en F5-13 */,
  loyaltyBonusPct: /* mismo rango aprobado en F5-13 */,
  commissionBasic: z.number().int().min(0).max(30),
  commissionStandard: z.number().int().min(0).max(30),
  commissionEnterprise: z.number().int().min(0).max(30),
  // Escrow
  escrowAutoReleaseHours: z.number().int().min(1).max(336),
  // Notificaciones (render en F5-15)
  notifyNewRequestRadiusKm: /* mismo schema aprobado en F5-13 */,
  notifyPaymentRelease: z.boolean(),
  notifyRatingReminderHours: /* mismo schema aprobado en F5-13 */,
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
```

`settings.mappers.ts`:

- `toFormValues(result: PlatformSettingsResult): SettingsFormValues` — centavos ÷ 100
  solo en `customerServiceFee`; `loyaltyBonusPct` permanece porcentaje; comisiones desde
  `commissionsByPlan`.
- `toUpdateInput(values, dirtyFields): UpdatePlatformSettingsInput` — solo las claves
  sucias, con `Math.round(v * 100)` en los montos.
- `toPlanCommissionsInput(values, original): UpdatePlanCommissionsInput` — envía
  `expected` con los 3 valores leídos y `commissions` con los 3 valores del form.

`settings-view.tsx` (`"use client"`):

```ts
const query = api.admin.settings.get.useQuery();
const form = useForm<SettingsFormValues>({
  resolver: zodResolver(settingsFormSchema),
  values: query.data?.result ? toFormValues(query.data.result) : undefined, // resync al refetch
  mode: "onBlur",
});
```

- Renderiza `PageHeader` + las secciones (cada una recibe `form` por prop; nada de context
  propio) + `settings-save-bar`.
- `query.data.error === "NOT_FOUND"` → `empty-state` "La configuración aún no existe"
  (singleton sin sembrar, ver F5-13) en lugar del formulario.

`settings-section-card.tsx`: wrapper `Card` con `title`, `description` y `children`;
`<section aria-labelledby>` para que cada grupo sea navegable por lectores de pantalla.

`settings-save-bar.tsx`: barra `sticky bottom-0` con `backdrop-blur`, texto "N cambios sin
guardar" (`aria-live="polite"`), botón secundario "Descartar" (`form.reset()`) y primario
"Guardar cambios" (`disabled={!isDirty || isPending}`, spinner mientras muta). El conteo
sale de `Object.keys(form.formState.dirtyFields).length`.

`use-settings-mutations.ts`: expone `save(values, dirtyFields, expectedUpdatedAt)` con una
sola mutation `admin.settings.save`; toasts por código (`VALIDATION_ERROR`, `NOT_FOUND`,
`SETTINGS_STALE`, `FORBIDDEN`) traducidos
desde `errors.json`; al éxito completo → toast + `form.reset(values)` (limpia dirty) +
`invalidate` de `admin.settings.get` y `admin.overview.getAiConfigSummary` (la card de W9
muestra umbral/modelo/última actualización, F5-02).

### Secciones de este ticket

- `ai-settings-section.tsx`:
  - Umbral de confianza: `Slider` (50–99, step 1) + `Input type="number"` sincronizados
    contra **el mismo campo RHF** (sin estado duplicado); sufijo "%"; helper "Por debajo
    del umbral la cotización pasa a revisión humana".
  - Margen de precio: `Input` numérico con prefijo "±" y sufijo "%" (5–50).
  - Modelo de precios: `Select` con `AI_PRICING_MODELS` (labels = el propio código).
  - `Switch` `aiHumanReviewBelowThreshold` con descripción traducida.
- `escrow-settings-section.tsx`:
  - `Input` numérico `escrowAutoReleaseHours` (1–336) con helper calculado en UI
    ("72 h ≈ 3 días") y nota: "Aplica solo a pagos futuros; los pagos ya en escrow
    conservan su fecha de auto-liberación" (invariante `Payment.escrowReleaseAt` congelado
    al cobrar, F3 — ver `F5-findings.md`).

### Otros

- `page.tsx`: server component delgado — prefetch `api.admin.settings.get` +
  `HydrateClient` → `<SettingsView />` (mismo patrón de W9–W12).
- `loading.tsx`: skeleton de cards de formulario. `error.tsx`: mensaje + retry.
- Componentes shadcn requeridos: `slider`, `switch`, `select`, `form` (instalación cubierta
  por `XC-13`; si aún no se aplicó, agregarlos con la CLI de shadcn antes de empezar).
- a11y: `<Label htmlFor>` en cada control, `aria-describedby` hacia el helper text,
  `Slider` con `aria-valuetext` ("85 por ciento"); todo operable por teclado.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- UI → cliente tRPC → procedure; los componentes jamás tocan Prisma ni recalculan rangos
  por su cuenta (el schema de F5-13 es la fuente).
- Toda respuesta consumida conserva `{ result, error, status, message }`
  (`TrpcResponse`); la UI valida el envelope antes de leer `result`.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos desde `settings.types.ts` /
  `settings.form.ts`.
- Identificadores, rutas y carpetas en inglés; TODO el copy vía next-intl (es/en),
  incluidos helpers, notas y textos de la barra de guardado.
- Dinero en centavos en el wire; la conversión a pesos vive solo en `settings.mappers.ts`.
- Componentización máxima: un archivo = una responsabilidad, en `_components/`; nada se
  importa desde `_components` de otro módulo.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.
- No se declaran rangos duplicados: el form deriva/refina los schemas aprobados de F5-13.

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Sin cambios, "Guardar cambios" está deshabilitado; al tocar un control aparece el
      conteo de cambios y se habilita; "Descartar" restaura los valores del servidor.
- [ ] Cambiar el umbral a 90 y guardar → toast de éxito, el form deja de estar sucio y W9
      (`ai-config-card`) muestra 90 sin recargar la página.
- [ ] El slider y el input del umbral quedan siempre sincronizados y no permiten salir de
      50–99; el servidor rechaza igualmente cualquier valor fuera de rango.
- [ ] es/en completos en las secciones IA y escrow; formulario operable solo con teclado.
- [ ] Dos admins con la misma versión: el segundo submit recibe `SETTINGS_STALE`, no pisa
      al primero y conserva sus cambios para revisión.

## Comandos para Roger (si aplica)

No aplica.
