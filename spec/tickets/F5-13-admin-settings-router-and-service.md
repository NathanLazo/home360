# [F5-13] Implementar `admin.settings`: schema con rangos, servicio del singleton y router

## Metadatos

- **Fase**: F5 — Panel admin
- **Spec origen**: `spec/05-admin.md` §5, `spec/08-business-model-alignment.md` D1–D3
- **Depende de**: `F5-01`
- **Tamaño estimado**: L (3–6 h)
- **Estado**: **BLOQUEADO** para producción hasta que Roger defina (a) bootstrap del
  singleton, (b) catálogo de `aiPricingModel` y (c) rangos de los campos que la spec dejó
  con puntos suspensivos. No convertir los valores propuestos abajo en decisiones.

## Contexto

Capa de datos de W13: lectura y escritura del singleton `PlatformSettings` y de las
comisiones por plan. Todas las validaciones de rango son **autoritativas en servidor**
(criterio de aceptación de la spec: "Settings validan rangos en servidor").

**Problemas detectados y resolución**:

1. La spec solo enumera 3 rangos ("umbral 50–99, margen 5–50, horas 1–336…"); los demás
   campos quedan sin límites. Los rangos 0–20 000, 1–100 y 1–168 escritos en la
   versión anterior eran propuestas no aprobadas. Deben confirmarse antes de codificar;
   una vez aprobados, `settings.schema.ts` será la única fuente para router y UI.
2. `aiPriceMarginPct` es un `Int` único pero el diseño lo muestra como "margen **±**%".
   **Resolución**: el campo guarda la **magnitud** de una banda simétrica (±), por eso el
   rango es 5–50 positivo; el signo es puro copy de UI.
3. `aiPricingModel` es `String` libre pero la UI es un `Select`; no existe catálogo.
   `["v3.0", "v3.1", "v3.2"]` era una propuesta. Roger debe confirmar el catálogo o
   decidir una fuente persistida; F5 no inventa versiones.
4. `PlatformSettings` solo lo crea el seed. Mantener `NOT_FOUND` hace W9/W13 inoperables
   en un despliegue sin seed; hacer `upsert` introduce efectos en lectura. Roger debe
   elegir bootstrap en migración o creación explícita. Hasta entonces se retorna
   `NOT_FOUND`, se muestra un bloqueo visible y no se declara W13 lista para producción.
5. "afecta solo pagos futuros" (spec §5) no es una acción, es un **invariante**: la
   comisión se congela por pago (`Payment.commissionPctApplied` / `commissionCents`,
   `spec/00` §3). **Resolución**: `updatePlanCommissions` solo escribe `Plan.commissionPct`
   y jamás toca `Payment`; se verifica por inspección manual.
6. El submit único de W13 no puede ser atómico si llama dos mutations secuenciales.
   **Resolución técnica**: además de las procedures granulares de la spec, el router expone
   `save` para la pantalla. `save` actualiza settings y, opcionalmente, las tres comisiones
   dentro de una sola transacción Prisma y usa `expectedUpdatedAt` para control optimista.

## Alcance

Crear/modificar:

- `src/app/[locale]/admin/settings/_components/settings.schema.ts` — schemas Zod
  compartidos por router/UI y constantes de dominio del módulo.
- `src/app/[locale]/admin/settings/_components/settings.types.ts` — tipos inferidos.
  (spec §6).
- `src/server/services/admin/platform-settings.ts` — acceso al singleton y a los planes.
- `src/server/api/routers/admin/settings.ts` — `get`, `update`,
  `updatePlanCommissions`, `save`.
- `src/server/api/routers/admin/index.ts` — montar `settings`.

Fuera de alcance: cualquier componente de UI (F5-14/F5-15); consumo de los valores por
otras fases (IA, escrow, notificaciones).

## Detalle técnico

### `settings.schema.ts`

```text
// Sustituir solo después de la decisión de Roger:
export const AI_PRICING_MODELS = [/* catálogo aprobado */] as const;
export const PLAN_CODES = ["basic", "standard", "enterprise"] as const;

export const platformSettingsSchema = z.object({
  aiConfidenceThresholdPct:    z.number().int().min(50).max(99),
  aiPriceMarginPct:            z.number().int().min(5).max(50),      // magnitud de ±%
  aiPricingModel:              z.enum(AI_PRICING_MODELS),
  aiHumanReviewBelowThreshold: z.boolean(),
  customerServiceFeeCents:     /* rango pendiente de aprobación */,
  // D3: el bono es un % del fee, no un monto fijo por volumen
  loyaltyBonusPct:             z.number().int().min(0).max(100),     // default 50 por D3
  escrowAutoReleaseHours:      z.number().int().min(1).max(336),     // 1 h – 14 días
  notifyNewRequestRadiusKm:    /* rango pendiente de aprobación */,
  notifyPaymentRelease:        z.boolean(),
  notifyRatingReminderHours:   /* rango pendiente de aprobación */,
}).strict();

export const platformSettingsPatchSchema = platformSettingsSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
export const updatePlatformSettingsSchema = z.object({
  expectedUpdatedAt: z.coerce.date(),
  patch: platformSettingsPatchSchema,
}).strict();

export const planCommissionValuesSchema = z.object({
  basic: z.number().int().min(0).max(30),
  standard: z.number().int().min(0).max(30),
  enterprise: z.number().int().min(0).max(30),
}).strict();
export const updatePlanCommissionsSchema = z.object({
  expected: planCommissionValuesSchema,
  commissions: planCommissionValuesSchema,
}).strict();

export const saveAdminSettingsSchema = z.object({
  expectedUpdatedAt: z.coerce.date(),
  settings: platformSettingsPatchSchema.optional(),
  expectedCommissions: planCommissionValuesSchema.optional(),
  commissions: planCommissionValuesSchema.optional(),
}).strict()
  .refine((v) => v.settings || v.commissions, { message: "no changes" })
  .refine((v) => Boolean(v.commissions) === Boolean(v.expectedCommissions), {
    message: "commissions and expectedCommissions must be sent together",
  });
```

- `.strict()` para que una clave desconocida sea `VALIDATION_ERROR` y no se ignore en
  silencio.
- Los rangos de los puntos 1–2 del Contexto son la referencia normativa del módulo.

### Servicio `platform-settings.ts`

Mismo patrón que los servicios admin de F5-05/F5-07: reciben `db` por parámetro y
retornan `ServiceResult`; solo las procedures adaptan a `TrpcResponse`.

```ts
const PLATFORM_SETTINGS_ID = 1;

getPlatformSettings(deps: { db: PrismaClient })
  : Promise<ServiceResult<PlatformSettingsResult>>
// 1. findUnique({ where: { id: PLATFORM_SETTINGS_ID }, select: <los 11 campos + updatedAt> })
//    → null: svcFail("NOT_FOUND", "platform settings not seeded")
// 2. plan.findMany({ select: { code, commissionPct } }) → commissionsByPlan por code
//    (code faltante → svcFail("NOT_FOUND", "plan missing"))
// 3. svcOk({ settings, commissionsByPlan })

updatePlatformSettings(deps, input: UpdatePlatformSettingsInput)
  : Promise<ServiceResult<PlatformSettings>>
// updateMany({ where: { id: PLATFORM_SETTINGS_ID, updatedAt: expectedUpdatedAt },
//   data: patch }); count 0 → SETTINGS_STALE; solo escribe las claves del patch.

updatePlanCommissions(deps, input: UpdatePlanCommissionsInput)
  : Promise<ServiceResult<{ commissionsByPlan: Record<PlanCode, number> }>>
// db.$transaction: por cada code, updateMany({
//   where: { code, commissionPct: expected[code] },
//   data: { commissionPct: commissions[code] }
// }); si algún count === 0 → abortar → SETTINGS_STALE.
// NUNCA toca Payment: la comisión ya cobrada está congelada (Contexto §5).

saveAdminSettings(deps, input: SaveAdminSettingsInput)
// db.$transaction:
// 1. updateMany PlatformSettings where { id: 1, updatedAt: expectedUpdatedAt };
//    si debía cambiar settings y count = 0 → SETTINGS_STALE (409).
// 2. si commissions existe, actualizar los 3 Plan por code; si falta uno, abortar.
// 3. retornar settings + commissions finales; los tres grupos o ninguno.
```

Result de `get`:

```ts
type PlatformSettingsResult = {
  settings: {
    aiConfidenceThresholdPct: number; aiPriceMarginPct: number;
    aiPricingModel: string; aiHumanReviewBelowThreshold: boolean;
    customerServiceFeeCents: number; loyaltyBonusPct: number;
    escrowAutoReleaseHours: number;
    notifyNewRequestRadiusKm: number; notifyPaymentRelease: boolean;
    notifyRatingReminderHours: number; updatedAt: Date;
  };
  commissionsByPlan: { basic: number; standard: number; enterprise: number };
};
```

### Router `admin.settings`

| Procedure | Tipo | Input | Result / Errores |
|-----------|------|-------|------------------|
| `get` | `adminProcedure.query` | — | `PlatformSettingsResult` · `NOT_FOUND` |
| `update` | `adminProcedure.mutation` | `updatePlatformSettingsSchema` | `settings` actualizado · `SETTINGS_STALE`, `VALIDATION_ERROR`, `NOT_FOUND` |
| `updatePlanCommissions` | `adminProcedure.mutation` | `updatePlanCommissionsSchema` | `{ commissionsByPlan }` · `SETTINGS_STALE`, `VALIDATION_ERROR`, `NOT_FOUND` |
| `save` | `adminProcedure.mutation` | `saveAdminSettingsSchema` | `PlatformSettingsResult` · `SETTINGS_STALE`, `VALIDATION_ERROR`, `NOT_FOUND` |

Procedures delgadas: validan input (Zod) y delegan en el servicio; sin lógica de negocio.
Rol no ADMIN → `FORBIDDEN` 403 uniforme (ya lo garantiza `adminProcedure`).

Consumidores y efecto temporal:

- IA (`ai*`) y notificaciones (`notify*`): app móvil futura; F5 solo persiste/configura.
- `customerServiceFeeCents`: F3 lo lee al capturar pagos futuros (D2).
- `loyaltyBonusPct`: F3-04 lo congela al devengar cada bono futuro (D3).
- `escrowAutoReleaseHours`: F3 fija `escrowReleaseAt` al cobrar; no recalcula pagos vivos.
- `Plan.commissionPct`: F3 congela porcentaje/monto al cobrar; no altera históricos.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables
  (`VALIDATION_ERROR`, `NOT_FOUND`).
- TODO el namespace `admin` con `adminProcedure`; 403 uniforme sin revelar recursos.
- Transacción Prisma para `updatePlanCommissions` (los 3 planes o ninguno).
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma.
- Identificadores, rutas y carpetas en inglés; este ticket no produce copy visible.
- Dinero en centavos (Int): `customerServiceFeeCents` viaja en centavos y la conversión a
  pesos ocurre solo en la UI (F5-15). `loyaltyBonusPct` es porcentaje entero, no dinero.
- Prisma: `select` explícito y mínimo; el singleton siempre por `id: 1`.
- BD: el agente solo puede ejecutar `pnpm prisma generate` (este ticket no cambia el schema).

## Criterios de aceptación

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
- [ ] Con el seed: `admin.settings.get` retorna los defaults vigentes (85 %, ±25 %, v3.2,
      $25, bono 50 %, 72 h, 10 km, 24 h) y `commissionsByPlan` = **10/8/5** (D1).
- [ ] `update` con `{ aiConfidenceThresholdPct: 120 }` → `VALIDATION_ERROR` 400 y el
      singleton no cambia; con `{ aiConfidenceThresholdPct: 90 }` → persiste y `updatedAt`
      avanza.
- [ ] `save` actualiza settings + planes en una sola transacción; conflicto de
      `expectedUpdatedAt` retorna `SETTINGS_STALE` sin aplicar cambios.
- [ ] `updatePlanCommissions` cambia los 3 planes y ningún `Payment` existente altera su
      `commissionPctApplied`/`commissionCents`.
- [ ] Llamar cualquiera de las 4 procedures con rol BUSINESS/CUSTOMER → `FORBIDDEN` 403.
- [ ] Todas las procedures respetan `{ result, error, status, message }`, sin `any`.
- [ ] Ningún rango pendiente ni catálogo IA se codifica antes de la aprobación de Roger.

## Comandos para Roger (si aplica)

No aplica (requiere el seed de F0 ya ejecutado: sin él, W13 responde `NOT_FOUND`).
