# [F6-16] Pase de calidad: tipografía y consistencia de UI

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §3 (Tipografía, Consistencia);
  `spec/00-foundations.md` §7 (`status-badge`, Geist Mono)
- **Depende de**: `F6-15` (copy consolidado; serializa barridos sobre los mismos archivos)
- **Tamaño estimado**: M

## Contexto

Dos dimensiones finales del checklist, agrupadas porque ambas tocan copy y componentes
compartidos: **tipografía** (comillas/guiones, tabular-nums, jerarquía de headings) y
**consistencia** (verbos de acción y orden en toasts/dialogs/botones, paleta unificada
de `StatusBadge`). Se aplican las skills `ui-typography` e `impeccable` como guía.

## Alcance

- `src/messages/{es,en}/*.json` (solo correcciones tipográficas y unificación de verbos;
  las claves no cambian salvo necesidad).
- `src/components/status-badge.tsx` (mapa unificado estado→variante).
- Componentes con montos/folios/SKU (clases `font-mono tabular-nums`).
- Headings en vistas donde haya saltos de jerarquía.

Fuera de alcance: a11y (F6-13), responsive (F6-15), estados (F6-12).

## Detalle técnico

### Tipografía

1. **Comillas y guiones** en ambos locales: es → comillas «» o "" consistentes (elegir
   una convención y aplicarla en todos los JSON), apóstrofos tipográficos ('), rayas —
   con espacios finos donde el diseño las use, en → "" y '. Cero comillas rectas `"` `'`
   en copy visible. Rangos con en dash (–): "1–3 h".
2. **Números**: montos, folios, SKU, porcentajes y contadores en tablas con Geist Mono +
   `tabular-nums` (verificar `kpi-card`, columnas de dinero, facturas, finanzas admin).
   Alineación a la derecha en columnas numéricas de tablas.
3. **Jerarquía de headings**: por pantalla, `h1` (título de página vía `PageHeader`) →
   `h2` (secciones/cards) → `h3`; sin saltos ni headings usados solo por tamaño (usar
   clases, no niveles, para estilo).

### Consistencia

4. **Verbos y orden de acciones**: convención única en todas las rutas públicas,
   dashboard y admin —
   confirmaciones "Guardar / Cancelar" (primario a la derecha en dialogs shadcn),
   destructivas "Eliminar" (variant destructive) con ConfirmDialog cuyo título repite el
   verbo ("¿Eliminar servicio?"); toasts en pasado ("Servicio eliminado", "Cambios
   guardados"). Auditar todos los `toast(...)`, `ConfirmDialog` y footers de
   Sheet/Dialog contra la convención y corregir los JSON.
5. **`StatusBadge` unificado**: un solo mapa tipado estado→variante en
   `status-badge.tsx` que cubra Order/Payment/Business/Service/Product/Branch/
   Subscription/Dispute/Withdrawal; mismas semánticas de color en toda la app (verde =
   activo/completado/pagado, ámbar = pausado/pendiente/stock bajo, rojo =
   suspendido/disputa/rechazado, zinc = neutro/borrador). Eliminar mapas locales
   duplicados en módulos que hayan creado el suyo (moverlos al compartido).
6. **Formato de identificadores**: folios siempre "#1042", montos siempre con formatter
   MXN (ya garantizado por F6-14 — aquí solo la presentación mono).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Estética zinc intacta; ningún cambio de paleta fuera del mapa de estados acordado.
- D7: correcciones de landing conservan marca; `StatusBadge` y herramientas internas
  permanecen zinc/semánticas y no consumen `--brand-*`.

## Criterios de aceptación

- [ ] Cero comillas/apóstrofos rectos en los JSON de mensajes; rangos y rayas correctos.
- [ ] Montos/folios/SKU en mono con `tabular-nums` y alineación derecha en tablas.
- [ ] Un único `StatusBadge` compartido; sin mapas de color duplicados en módulos.
- [ ] Toasts/dialogs/botones siguen la convención en todas las rutas, incluido team/settings.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde (paridad i18n intacta).

## Comandos para Roger (si aplica)

—
