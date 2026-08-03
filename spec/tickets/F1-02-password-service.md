# [F1-02] Implementar servicio de password (bcryptjs)

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §1 (hash) · `spec/00-foundations.md` §2 (dep `bcryptjs`)
- **Depende de**: F0 completada (`bcryptjs` instalado en `F0-02`)
- **Tamaño estimado**: S

## Contexto

Único punto del sistema que toca bcrypt (spec §1): el servicio se usa en `authorize`
(F1-03) y en el registro de negocio (F1-04). Se implementa primero para que ambos tickets
lo consuman.

La spec original acompañaba este servicio con `password.test.ts` y con el bootstrap de
Vitest. **El proyecto no lleva pruebas automatizadas** (decisión de Roger), así que ese
alcance desaparece: no se crea `vitest.config.ts`, ni script `test`, ni archivos de prueba.

## Alcance

Crear:

- `src/server/services/auth/password.ts`

Fuera de alcance: cualquier consumo del servicio (F1-03/F1-04), configuración de testing.

## Detalle técnico

`password.ts` — API exacta de la spec §1, cost 12:

```ts
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export const hashPassword = (plainPassword: string): Promise<string> =>
  bcrypt.hash(plainPassword, BCRYPT_COST);

export const verifyPassword = async (
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> => {
  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch (_error: unknown) {
    return false;
  }
};
```

El cost 12 es una constante del módulo, no configurable por entorno. bcrypt codifica el cost
dentro de cada hash, por lo que los hashes anteriores siguen verificando si el cost cambia;
este ticket lo fija en 12 para mantener una política uniforme y un costo de CPU predecible.

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

- [ ] `hashPassword` y `verifyPassword` exportados desde `src/server/services/auth/password.ts`.
- [ ] Ningún otro archivo del repo importa `bcryptjs` directamente (grep limpio).
- [ ] Contraseña incorrecta y hash malformado producen `false`; nunca se registra el valor
      recibido.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
