# [F6-13] Auditar accesibilidad en todas las rutas

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §3 (Accesibilidad); criterios F2 §
  aceptación (teclado/focus)
- **Depende de**: `F6-12` (serializa barridos sobre los mismos archivos)
- **Tamaño estimado**: L

## Contexto

Dimensión **accesibilidad** del checklist final, aplicando las skills
`web-design-guidelines` y `better-accessibility` como guía de revisión. Radix (base de
shadcn) resuelve gran parte del teclado/focus; el pase se centra en lo que Radix no
cubre: labels, contraste, `alt`, semántica y usos incorrectos.

## Alcance

Cualquier componente bajo `src/app/` y `src/components/` (solo cambios de a11y:
atributos, labels, orden de foco, tokens de color donde falle contraste). Fuera de
alcance: cambios estructurales de layout (F6-15), copy general (F6-14), lógica.

## Detalle técnico

Checklist por familia de componentes, ejecutado en todas las rutas públicas, dashboard y admin:

1. **Teclado**: Sheets, Dialogs, AlertDialogs, DropdownMenus, Tabs y Selects abren,
   navegan y cierran con teclado (Tab/flechas/Escape/Enter); ningún trap fuera de
   modales; el foco regresa al trigger al cerrar (Radix por defecto — verificar que
   ningún `onOpenChange` custom lo rompa).
2. **Focus visible**: anillo de foco visible sobre fondo `#f4f4f5` y sobre el sidebar
   oscuro `#18181b` (revisar `--ring` en ambas superficies). Nada de `outline-none` sin
   reemplazo.
3. **Íconos-botón**: todo botón solo-icono (acciones ⋯ de filas, LocaleSwitcher, cerrar
   Sheet, etc.) con `aria-label` traducido o `sr-only`.
4. **Formularios**: cada Input/Select/Textarea con `<Label htmlFor>`; errores ligados con
   `aria-describedby` + `aria-invalid`; grupos con `fieldset/legend` donde aplique
   (pasos del registro).
5. **Contraste AA**: revisar específicamente los badges ámbar (Pausado, stock bajo,
   PAST_DUE) y el texto muted `#71717a` sobre zinc: ratio ≥ 4.5:1 para texto normal
   (ajustar el token del badge — p. ej. ámbar más oscuro sobre fondo ámbar claro — sin
   salir de la paleta del diseño). Verificar texto claro sobre `#18181b` en
   dashboard/admin y combinaciones navy/gold/cream/gray en la landing de marca.
6. **Imágenes y decorativos**: `alt` significativo o `alt=""`+`aria-hidden` en
   decorativos (hero visual, iconos lucide junto a texto → `aria-hidden`).
7. **Semántica**: una `h1` por pantalla y jerarquía sin saltos; landmarks (`header`,
   `nav`, `main`, `footer`) en landing y layouts; tablas con `<th scope="col">`
   (verificar `DataTable`); toasts de sonner anunciados (`richColors`/rol status por
   defecto — verificar).
8. **Landing**: anclas alcanzables por teclado; reduced motion conserva un solo árbol
   semántico y `MotionSafe` se limita al beam decorativo.

Método: recorrido manual con teclado + revisión de código por componente compartido
(`data-table`, `status-badge`, `confirm-dialog`, `search-filter-bar`, `app-sidebar`)
primero — un fix en un compartido corrige todas las pantallas — y después por módulo.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- D7 intacta: ajustes en landing usan la paleta de marca; dashboard/admin usan zinc/ámbar.

## Criterios de aceptación

- [ ] Todas las rutas públicas, dashboard y admin navegables por teclado con focus visible.
- [ ] Cero botones-icono sin nombre accesible; cero inputs sin label.
- [ ] Badges ámbar y texto muted pasan AA (documentar ratios ajustados en el PR).
- [ ] Contraste AA documentado por combinación crítica de marca y zinc, sin cruzar tokens.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
