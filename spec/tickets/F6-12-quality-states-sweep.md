# [F6-12] Auditar estados loading, error y empty en todas las rutas

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §3 (Estados); specs F2–F5 (cada módulo ya
  exige `loading.tsx`/`error.tsx`/empty)
- **Depende de**: `F6-06`, `F6-09`, `F6-11`, `F5-16` (F6a y F5 completos)
- **Tamaño estimado**: M

## Contexto

El checklist final de la spec se ejecuta como tickets por dimensión (no un mega-ticket).
Este cubre la dimensión **estados**: cada ruta con `loading.tsx` (skeleton fiel al layout
final), `error.tsx` (mensaje + retry) y empty states con CTA. Es un pase de auditoría +
relleno de huecos: las fases previas ya debían crear estos archivos; aquí se verifica y
completa lo que falte.

## Alcance

Auditar y crear/corregir solo archivos de estado y empty states en:

- `src/app/[locale]/dashboard/{,services,products,payments,subscription,branches,orders,team,settings}/`
  → `loading.tsx`, `error.tsx`.
- `src/app/[locale]/admin/{,users,disputes,finance,settings}/` → ídem.
- Empty states dentro de los `_components/` de cada módulo (solo si faltan o carecen de CTA).
- `(public)`: landing, login, register, forgot-password y reset-password no llevan loading
  de datos salvo que su implementación realmente suspenda; verificar que no exista un
  fallback que cause flash. Sus estados de formulario (idle/submitting/success/error)
  sí se auditan en sus `_components/`.

Fuera de alcance: lógica de negocio, routers, estilos generales, i18n global (F6-14).

## Detalle técnico

Recorrido por todas las rutas anteriores, incluidas orders/team/settings que no están en
W1–W13, con esta pauta:

1. **`loading.tsx`**: skeleton con la misma estructura que la vista final (mismo
   `PageHeader` fantasma, mismo número de columnas/cards) usando el `Skeleton` de shadcn.
   Nada de spinners genéricos a pantalla completa.
2. **`error.tsx`** (`"use client"` obligatorio en App Router): recibe
   `{ error, reset }`; muestra icono + título + descripción traducidos
   (`common.error.title/description`) y botón "Reintentar" que llama `reset()`. Nunca
   renderiza `error.message` crudo al usuario.
3. **Empty states**: toda tabla/lista/grid sin datos usa `EmptyState` (F0) con icono,
   texto y **CTA accionable** (p. ej. "Nuevo servicio" abre el Sheet; en listas
   filtradas, "Limpiar filtros"). Distinguir "sin datos" de "sin resultados de búsqueda".
4. Verificar que los skeletons no rompen con el sidebar/responsive (usar el layout real).
5. Claves i18n nuevas en `common.json` (`error.*`, `empty.*` genéricos) y por módulo
   donde el copy sea específico — siempre es y en a la vez.

Entregable adicional: tabla resumen ruta → {loading, error, empty} con estado
encontrado/creado/corregido, incluida en la descripción del commit o PR (no como archivo
en el repo).

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] Toda ruta de dashboard y admin tiene `loading.tsx` fiel y `error.tsx` con retry.
- [ ] Todo listado tiene empty state con CTA; búsquedas sin resultados tienen su propio
      mensaje.
- [ ] Cero mensajes de error crudos del servidor en pantalla.
- [ ] Landing/auth no muestran fallback espurio; formularios públicos cubren submit,
      éxito y error sin perder datos válidos.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
