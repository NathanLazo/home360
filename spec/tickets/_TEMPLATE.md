# [F<N>-NN] Título imperativo corto

> Plantilla de ticket. Cada ticket debe ser **autocontenido**: un agente sin acceso a esta
> conversación debe poder implementarlo leyendo solo este archivo, las secciones de spec
> citadas y el código del repo.

## Metadatos

- **Fase**: F<N> — nombre de la fase
- **Spec origen**: `spec/0X-….md` §sección(es)
- **Depende de**: tickets previos (ej. `F0-01`) o "—"
- **Tamaño estimado**: S (< 1 h) · M (1–3 h) · L (3–6 h) — si es más grande, dividir el ticket

## Contexto

2–5 líneas: qué parte del sistema toca y por qué existe este ticket. Si el ticket nace de
un **problema detectado en la spec** (inconsistencia, hueco, riesgo), describirlo aquí con
la resolución elegida.

## Alcance

Lista exacta de archivos a crear/modificar (rutas relativas al repo). Qué queda
explícitamente **fuera** de alcance.

## Detalle técnico

Lo necesario para implementar sin ambigüedad: schemas Zod, firmas de servicios,
procedures con su I/O `TrpcResponse`, árbol de componentes, claves i18n nuevas, etc.
Citar la spec en vez de duplicarla cuando la spec ya es precisa.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] Checklist verificable (typecheck/lint/tests verdes, comportamiento observable).

## Comandos para Roger (si aplica)

Migraciones, seed, `stripe listen`, scripts — listados, nunca ejecutados por el agente.
