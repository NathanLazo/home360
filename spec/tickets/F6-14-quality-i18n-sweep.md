# [F6-14] Pase de calidad: barrido i18n (strings, paridad es/en, formatos)

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §3 (i18n); `spec/00-foundations.md` §6
- **Depende de**: `F6-13` (serializa barridos sobre los mismos archivos)
- **Tamaño estimado**: M

## Contexto

Dimensión **i18n** del checklist: cero strings hardcodeados en JSX, ambos locales
completos, copy de correos localizado y fechas/moneda formateadas por next-intl en el
100 % de los casos. La paridad se verifica en este pase sin crear tests ni archivos de
testing.

## Alcance

- Cualquier archivo bajo `src/app/` y `src/components/` (solo sustitución de literales
  por `t(...)` y de formateos manuales por `useFormatter`/`getFormatter`).
- `src/messages/{es,en}/*.json` (claves faltantes en cualquiera de los dos locales).
- Servicios de email que producen copy visible (solo para mover literales al namespace
  `emails` y seleccionar es/en; sin cambiar transporte ni dominio).

Fuera de alcance: redacción/estilo del copy (F6-16), lógica de dominio y tests automatizados.

## Detalle técnico

1. **Barrido de literales**: grep sobre `src/**/*.tsx` de texto visible en JSX
   (patrones: `>[A-Za-zÁ-Úá-ú]` entre tags, atributos `placeholder=`, `title=`,
   `aria-label=`, `alt=` con string literal, y llamadas `toast("...")`). Cada hallazgo →
   clave en el namespace del módulo. Excepciones permitidas: "—", "·", "HOME360", "H",
   folios y SKU de ejemplo.
2. **Paridad de claves**: para cada namespace, comparar `es/<ns>.json` contra
   `en/<ns>.json` y confirmar que el conjunto de rutas de claves es idéntico. Además,
   `errors.json` debe tener una clave por cada código de `ERROR_CODES`
   (`src/server/api/contract.ts`) y por cada código de dominio declarado por los módulos
   (`EMAIL_TAKEN`, `SKU_TAKEN`, `CURRENT_PASSWORD_INVALID`, …). Documentar el resultado
   del barrido en el PR.
3. **Moneda**: todo monto renderizado pasa por el formatter MXN desde centavos (buscar
   `/100`, `$` + template literals, `toLocaleString` sueltos). Centralizar si existe
   duplicación evidente (`formatCurrency` en `src/lib/` si F2 no lo creó).
4. **Fechas**: `Date` renderizadas solo vía formatter (fechas absolutas y relativas);
   sin `toLocaleDateString` con locale hardcodeado.
5. **Números**: contadores y porcentajes vía formatter (separador de miles por locale).
6. Verificar ambos locales en runtime en landing/auth, cada ruta dashboard y cada ruta
   admin, sin claves crudas visibles (`namespace.key` en pantalla = bug). Revisar también
   preview del correo de invitación F6-08 en es/en.

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

- [ ] Grep de literales visibles en JSX sin hallazgos (fuera de las excepciones listadas).
- [ ] Paridad exacta de claves es/en en todos los namespaces, y una clave de `errors.json`
      por cada código de error del proyecto, comprobada sin crear tests.
- [ ] UI y correo de invitación no contienen copy visible hardcodeado y seleccionan locale.
- [ ] Cero formateos manuales de moneda/fecha/número.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
