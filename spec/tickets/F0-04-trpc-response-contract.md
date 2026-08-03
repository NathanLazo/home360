# [F0-04] Crear el contrato TrpcResponse y la normalización de errores

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §4, §5 (nota sobre TRPCError)
- **Depende de**: `F0-02`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Todo procedure del proyecto retorna `TrpcResponse<TResult, TError>`; este ticket crea el
contrato, los helpers `ok`/`fail` y `normalizeError`.

**Problemas detectados y resoluciones**:

1. **Inconsistencia de tipos en la spec**: `fail` está tipado para aceptar solo
   `ErrorCode`, pero la propia spec §4 dice que los módulos declaran códigos propios
   (`EMAIL_TAKEN`, `SKU_TAKEN`…) y los pasan por el genérico `TError` — con la firma de la
   spec eso no compila. **Resolución**: `fail` es genérico también en el código de error
   (`E extends string = ErrorCode`), ver firma abajo.
2. **Redacción ambigua en §5** sobre el `errorFormatter`: la lectura final es que las
   guardas de rol lanzan `TRPCError` **solo** para `UNAUTHORIZED`/`FORBIDDEN` y un helper
   compartido del lado cliente los mapea a códigos del contrato. Ese helper se crea aquí
   (`src/lib/trpc-errors.ts`) para que F1+ lo consuman.

## Alcance

Crear:

- `src/server/api/contract.ts`
- `src/lib/trpc-errors.ts`
(sin archivo de pruebas: el proyecto no lleva testing automatizado)

Fuera de alcance: procedures por rol (F0-05), routers de dominio (F1+), claves i18n de
`errors.json` (F0-07 crea el archivo con los 11 códigos base).

## Detalle técnico

`src/server/api/contract.ts`:

```ts
export type TrpcResponse<TResult, TError extends string = ErrorCode> = {
  result: TResult | null;
  error: TError | ErrorCode | null;
  status: number;
  message: string;
};

export const ERROR_CODES = [
  "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "CONFLICT",
  "PLAN_LIMIT_REACHED", "BUSINESS_NOT_ACTIVE", "INSUFFICIENT_BALANCE",
  "STRIPE_ERROR", "INTERNAL_ERROR", "UNKNOWN_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ok = <T>(result: T, message: string, status = 200):
  TrpcResponse<T> => ({ result, error: null, status, message });

export const fail = <T = never, E extends string = ErrorCode>(
  error: E | ErrorCode,
  status: number,
  message: string,
): TrpcResponse<T, E> => ({ result: null, error, status, message });

export function normalizeError(error: unknown): { code: ErrorCode; status: number } { … }
```

`normalizeError` (mismo archivo):

- Detecta `Prisma.PrismaClientKnownRequestError` (import desde `generated/prisma`):
  `P2002 → { CONFLICT, 409 }`, `P2025 → { NOT_FOUND, 404 }`, resto → `INTERNAL_ERROR, 500`.
- Detecta errores de Stripe por narrowing estructural (`typeof error === "object"` y
  `"type" in error` con prefijo `Stripe`) o `instanceof Stripe.errors.StripeError` si el
  import no crea dependencia circular → `{ STRIPE_ERROR, 502 }`.
- Cualquier otro `unknown` → `{ UNKNOWN_ERROR, 500 }`. Jamás re-lanza ni incluye
  `error.message` del original en la salida (nada de stack/SQL hacia el cliente).

`src/lib/trpc-errors.ts` (usable en cliente):

```ts
import { TRPCClientError } from "@trpc/client";
import type { ErrorCode } from "~/server/api/contract";

/** Maps transport-level tRPC errors (thrown by role guards) to contract codes. */
export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof TRPCClientError) {
    const code: unknown = error.data?.code;
    if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
    if (code === "FORBIDDEN") return "FORBIDDEN";
  }
  return "UNKNOWN_ERROR";
}
```

(Importar solo el **tipo** desde `contract.ts` para no arrastrar código server al bundle;
si `ERROR_CODES` hiciera falta en runtime cliente, mover la constante a
`src/lib/error-codes.ts` y reexportarla desde `contract.ts` — decisión del implementador,
documentarla en el código.)

`normalizeError` debe mapear P2002 y P2025 de Prisma y cualquier valor desconocido a un
código estable, y **nunca lanzar**: es el último borde antes de responder al cliente.

Convención (documentar en JSDoc del archivo): `message` es texto corto de referencia en
inglés para logs/debug; la UI **siempre** traduce a partir de `error` con
`errors.json`.

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

- [ ] `contract.ts` exporta `TrpcResponse`, `ERROR_CODES`, `ErrorCode`, `ok`, `fail`, `normalizeError`.
- [ ] `fail("EMAIL_TAKEN", 409, "…")` compila cuando el módulo declara ese código vía genérico.
- [ ] `pnpm build` en verde.
- [ ] `pnpm typecheck` y `pnpm check` en verde; cero `any`.

## Comandos para Roger (si aplica)

— (ninguno).
