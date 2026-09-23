# F5 — Panel admin

Cubre **W9 (resumen)**, **W10 (usuarios)**, **W11 (disputas)**, **W12 (finanzas)** y
**W13 (configuración)**. Requiere F3 (dinero); se integra con F4 (crear suscripción al
aprobar). Todo con `adminProcedure`; routers bajo el namespace `admin` en `root.ts`
(`admin: createTRPCRouter({ overview, users, disputes, finance, settings })`).

`admin/layout.tsx`: `AppSidebar variant="dark"` (fondo `#18181b`, texto claro), badge con
conteo de disputas abiertas, verificación de rol en servidor.

## 1. W9 — Resumen `/admin`

### Router `admin.overview`

| Procedure | Result |
|-----------|--------|
| `getKpis` | `{ totalUsers, newUsersMonth, activeBusinesses, pendingBusinesses, gmvCents, gmvDeltaPct, escrowCents, escrowOrders }` |
| `getPendingBusinesses` | top 5: `{ id, name, type, guaranteeType }` |
| `getOpenDisputes` | top 3 con urgencia, partes y monto en escrow |
| `getAiConfigSummary` | umbral, modelo, última actualización (de `PlatformSettings`) |

GMV = Σ pagos del mes (todos los estados cobrados). Módulo: `kpi-row` (4 KpiCards),
`pending-businesses-table.tsx` (acciones rápidas Aprobar/Revisar), `open-disputes-list.tsx`
(links a W11), `ai-config-card.tsx` (link a W13).

## 2. W10 — Usuarios `/admin/users`

### Router `admin.users`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` | `{ tab: "businesses"\|"customers"\|"workers", search?, status?, cursor? }` | filas por tipo + `counts` por tab |
| `getBusinessDetail` | `{ businessId }` | perfil completo: garantía, docs, órdenes, disputas |
| `approveBusiness` | `{ businessId, planCode }` | `{ id }` — transacción: `status ACTIVE` + crea `Subscription` (F4) + cuenta Connect placeholder |
| `rejectBusiness` | `{ businessId, reason }` | `{ id }` |
| `suspendBusiness` / `reactivateBusiness` | `{ businessId, reason? }` | `{ id }` · CONFLICT si tiene disputa abierta (suspender no; reactivar sí bloqueado) |
| `exportCsv` | `{ tab }` | `{ csv: string }` (descarga client-side) |

Estados visibles del diseño: Activo, Pendiente, En disputa (derivado: tiene disputa
abierta), Suspendido.

### Módulo

```text
users/  page.tsx · loading.tsx · error.tsx  +  _components/
├─ users-view.tsx                # Tabs Negocios/Clientes/Trabajadores con counts
├─ users-filters.tsx             # búsqueda + Select estado
├─ businesses-table.tsx          # avatar iniciales, garantía, registro, órdenes, estado, acciones
├─ customers-table.tsx · workers-table.tsx
├─ user-row-actions.tsx          # DropdownMenu contextual por estado
├─ business-detail-sheet.tsx     # Sheet: perfil + documentos + historial
├─ approve-business-dialog.tsx   # Dialog: revisar garantía + elegir plan inicial → aprobar
├─ suspend-business-dialog.tsx   # AlertDialog con razón obligatoria
├─ guarantee-badge.tsx           # Depósito / Verificación / Seguro por servicio / Bien registrado / Combinada A+B
├─ users.schema.ts · users.types.ts
└─ use-user-mutations.ts
```

## 3. W11 — Disputas `/admin/disputes` (master-detail)

### Router `admin.disputes`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `list` | `{ status?: "open"\|"resolved" }` | `{ items, openCount, resolvedThisMonth }` |
| `getById` | `{ disputeId }` | expediente completo: orden, partes, grabación, evidencias, argumentos, `aiSummary`, pago en escrow |
| `resolve` | `{ disputeId, resolution: DisputeResolution, partialAmountCents? }` | `{ id }` · `VALIDATION_ERROR` si parcial sin monto o monto > escrow · `CONFLICT` si ya resuelta |

`resolve` — servicio `src/server/services/disputes/resolve-dispute.ts`, **transacción**:

| Resolución | Efecto en dinero (via `escrow.ts` F3) | Estado |
|------------|----------------------------------------|--------|
| `FULL_REFUND` | refund total al cliente | Dispute RESOLVED, Payment REFUNDED, Order CANCELLED |
| `PARTIAL_REFUND` | refund parcial + release del resto | RESOLVED, PARTIALLY_REFUNDED |
| `RELEASE_PAYMENT` | release completo al negocio | RESOLVED, RELEASED |
| `MORE_EVIDENCE` | sin movimiento | Dispute permanece IN_REVIEW |

### Módulo

```text
disputes/  page.tsx · loading.tsx · error.tsx  +  _components/
├─ disputes-view.tsx             # split: lista (izq) + expediente (der); en móvil, lista → detalle
├─ dispute-list.tsx · dispute-list-item.tsx   # urgencia (Urgente rojo / En revisión ámbar / Resuelta gris)
├─ dispute-detail.tsx            # orquesta el expediente
├─ dispute-recording-player.tsx  # video de la grabación + duración
├─ dispute-evidence-grid.tsx     # miniaturas "+4"
├─ dispute-arguments.tsx         # CLIENTE / NEGOCIO citados
├─ dispute-ai-summary.tsx        # card destacada con el resumen IA (minuto exacto)
├─ dispute-resolution-actions.tsx# 4 botones del diseño
├─ resolve-dispute-dialog.tsx    # AlertDialog con resumen del efecto monetario; input de monto si parcial
├─ disputes.schema.ts · disputes.types.ts
└─ use-dispute-mutations.ts
```

La selección de disputa vive en `?dispute=<id>` (deep-linkeable desde W9).

## 4. W12 — Finanzas `/admin/finance`

### Router `admin.finance`

| Procedure | Input | Result / Errores |
|-----------|-------|------------------|
| `getKpis` | `{ month? }` | `{ commissionCents (+delta), subscriptionCents, activeBusinesses, escrowCents, escrowOrders, pendingWithdrawalsCents, pendingWithdrawalsCount }` |
| `listWithdrawals` | `{ status? , cursor? }` | negocio, monto, banco+últimos4, solicitado, estado |
| `approveWithdrawal` | `{ withdrawalId }` | `{ id }` — crea un Stripe Payout manual vía F3 y persiste `stripePayoutId` · `CONFLICT` si negocio suspendido |
| `rejectWithdrawal` | `{ withdrawalId, reason }` | `{ id }` |
| `getRevenueBreakdown` | `{ months: 6 }` | serie mensual comisiones vs. suscripciones + `{ commissionCents, subscriptionCents, loyaltyBonusCents }` |

Retiro de negocio suspendido: fila deshabilitada con nota "Cuenta suspendida" (diseño W12).

### Módulo

`finance-kpi-row`, `withdrawals-table.tsx` + `withdrawal-row-actions.tsx`
(Aprobar → ConfirmDialog con monto y cuenta; Rechazar → AlertDialog con razón),
`platform-revenue-chart.tsx` (Recharts: comisiones vs. suscripciones),
`revenue-breakdown-list.tsx` (incluye "Bonos de lealtad pagados" en negativo).

## 5. W13 — Configuración `/admin/settings`

### Router `admin.settings`

| Procedure | Input | Result |
|-----------|-------|--------|
| `get` | — | `PlatformSettings` completo + `commissionsByPlan` (de `Plan`) |
| `update` | `platformSettingsSchema` (parcial, rangos validados: umbral 50–99, margen 5–50, horas 1–336…) | settings actualizado |
| `save` | `{ expectedUpdatedAt, settings?, expectedCommissions?, commissions? }` — `commissions` = `{ basic, standard, enterprise }` (0–30), siempre junto con `expectedCommissions` (concurrencia optimista) | settings y/o comisiones de plan guardados en una sola transacción — las comisiones afectan solo pagos futuros |

> `updatePlanCommissions` se retiró: las comisiones por plan se guardan con
> `admin.settings.save` (mismo submit "Guardar cambios" del formulario).

### Módulo

Formulario por secciones (un `Card` por grupo, submit único "Guardar cambios" sticky):

```text
settings/  page.tsx  +  _components/
├─ settings-view.tsx             # react-hook-form + zodResolver sobre el schema completo
├─ ai-settings-section.tsx       # umbral (slider+input), margen ±%, modelo (Select), switch revisión humana
├─ fees-settings-section.tsx     # comisiones por plan, tarifa de servicio, bono de lealtad
├─ escrow-settings-section.tsx   # horas de auto-liberación
├─ notifications-settings-section.tsx  # switches + radios del diseño
├─ settings.schema.ts · settings.types.ts
└─ use-settings-mutations.ts     # dirty-state → habilita "Guardar cambios"
```

## 6. Pruebas

- `resolve-dispute.test.ts`: los 4 caminos mueven (o no) el dinero correcto; parcial >
  escrow → `VALIDATION_ERROR`; doble resolve → `CONFLICT`.
- `approve-business.test.ts`: transacción crea suscripción; rechazo no.
- `finance-kpis.test.ts`: breakdown cuadra con seed.
- `settings.schema.test.ts`: rangos fuera de límite rechazados.

## 7. Verificación

Manual con seed (login admin): aprobar "Eléctrica Volta" → aparece ACTIVE con suscripción;
resolver la disputa URGENT con reembolso parcial → Payment PARTIALLY_REFUNDED y transfer
del resto (visible en Stripe test); aprobar retiro de Plomería García → Transfer creado;
cambiar umbral IA a 90 → persiste y se refleja en W9.

### Criterios de aceptación

- [ ] Las 5 pantallas replican el diseño (sidebar oscuro, master-detail de disputas, tabs de usuarios).
- [ ] Resolución de disputas y aprobación de retiros son transaccionales e idempotentes.
- [ ] Ningún router admin accesible con rol BUSINESS/CUSTOMER (403 uniforme).
- [ ] Settings validan rangos en servidor; cambios de comisión no tocan pagos históricos.
