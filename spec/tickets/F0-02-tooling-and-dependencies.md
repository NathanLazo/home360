# [F0-02] Instalar dependencias nuevas y tooling (tsx, scripts)

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §2, §9 (scripts)
- **Depende de**: —
- **Tamaño estimado**: S (< 1 h)

## Contexto

F0 necesita las dependencias base del stack (Stripe SDK, bcryptjs, next-intl, recharts) y
`tsx` para ejecutar el seed.

**Problemas detectados y resoluciones**:

1. La spec pide `pnpm add -D @types/bcryptjs`, pero `bcryptjs` v3 (feb 2025) ya trae tipos
   propios y el paquete `@types/bcryptjs` quedó como stub obsoleto. **Resolución**:
   instalar `bcryptjs@^3` sin `@types/bcryptjs`.
2. Recharts requiere soporte de React 19. **Resolución**: instalar `recharts@^2.15`
   (primera línea con soporte React 19) o superior 2.x.
3. La spec no menciona `tsx` en §2 pero §9 lo exige para el seed. **Resolución**:
   instalarlo aquí como devDependency.
4. La spec instalaba `vitest`. **Resolución**: el proyecto **no lleva pruebas
   automatizadas** (decisión de Roger); no se instala vitest ni se crea `vitest.config.ts`.
   La verificación de cada ticket es `pnpm typecheck`, `pnpm check` y `pnpm build`.

## Alcance

Modificar:

- `package.json` — dependencias, devDependencies, scripts y bloque `prisma`.
- `pnpm-lock.yaml` — lockfile actualizado exclusivamente mediante `pnpm`.

Fuera de alcance: shadcn/ui y sus componentes (F0-06), seed en sí (F0-11), cualquier
herramienta de testing.

## Detalle técnico

Comandos (el agente puede ejecutarlos; no tocan la BD):

```bash
pnpm add stripe bcryptjs@^3 next-intl recharts@^2.15
```

```bash
pnpm add -D tsx
```

`package.json` — agregar script de seed y bloque prisma (conservar los existentes):

```jsonc
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Notas:

- No fijar `apiVersion` de Stripe aquí; eso vive en `src/server/services/stripe/client.ts`
  (F0-10).
- `prisma/seed.ts` aún no existe (F0-11); los scripts pueden apuntar a él desde ya —
  nadie los ejecuta hasta F0-11 (y solo Roger).

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

- [ ] `stripe`, `bcryptjs` (v3+), `next-intl`, `recharts` (≥ 2.15) en `dependencies`.
- [ ] `tsx` en `devDependencies`; sin `@types/bcryptjs`, sin `vitest`.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno).
