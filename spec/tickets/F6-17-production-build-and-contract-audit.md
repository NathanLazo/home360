# [F6-17] Ejecutar la primera build de producción y auditar el contrato del `appRouter`

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §4.1 y §Criterios de aceptación (`pnpm build`
  en verde; contrato `TrpcResponse` uniforme en todo el `appRouter`);
  `spec/00-foundations.md` §4 (contrato), `spec/README.md` §Convenciones 5
- **Depende de**: `F6-12`, `F6-13`, `F6-14`, `F6-15`, `F6-16`; F2–F5 implementadas
- **Tamaño estimado**: L

## Contexto

**Hueco de cobertura detectado**: cada ticket exige build verde, pero este ticket es el
dueño del cierre agregado y del reporte de la primera build completa del proyecto.
Tampoco hay ticket que verifique el criterio de aceptación transversal "contrato
`TrpcResponse` uniforme en todo el `appRouter`" — cada fase lo cumple en sus propias
procedures, pero nadie lo comprueba de forma agregada al final.

La primera `next build` de un proyecto App Router destapa una clase de errores que
`tsc --noEmit` no ve (fronteras server/client, prerender de rutas que usan `auth()`,
`generateStaticParams` de `[locale]`, validación de `src/env.js` en build). Este ticket es
el pase que los caza y los corrige.

## Alcance

Modificar **solo lo que la build o la auditoría señalen**:

- Cualquier archivo bajo `src/` que la build reporte (directivas `"use client"`,
  `export const dynamic`, `generateStaticParams`, imports server-only filtrados).
- `src/server/api/routers/*.ts` y `src/server/services/**` para uniformar retornos y
  `catch` que no cumplan el contrato.
- `next.config.js` y `.env.example` solo si la build lo exige.

Fuera de alcance: features nuevas, rediseños, verificación manual y revisión contra el
diseño (`F6-18`), cambios de schema.

## Detalle técnico

### 1. Build de producción

```bash
pnpm build
```

Errores esperables y su resolución canónica (no inventar otras):

1. **next-intl y rendering estático**: cada `page.tsx` bajo `[locale]` debe llamar
   `setRequestLocale(locale)` y el layout de locale debe exportar `generateStaticParams`
   con los locales de `src/i18n/routing.ts`. Sin eso la landing se vuelve dinámica y
   pierde el prerender (regresión directa del objetivo de W1).
2. **Fronteras server/client**: todo componente que realmente use hooks, `motion`,
   `matchMedia` o handlers (componentes Magic UI animados, `MotionSafe`, `landing-header`, vistas con
   `useQuery`) lleva `"use client"`. Ningún componente cliente puede importar
   `~/server/**`, `generated/prisma` ni `src/env.js` server-side.
3. **Rutas con sesión**: layouts/páginas de `dashboard` y `admin` usan `auth()`/`cookies()`
   → deben quedar dinámicas. Si la build intenta prerenderarlas, declarar el motivo
   (uso de dynamic API) en vez de silenciarlo con `force-dynamic` sin justificación.
4. **`src/env.js`**: la build valida env. Documentar en `.env.example` el mínimo necesario
   para construir; no deshabilitar la validación en el repo (`SKIP_ENV_VALIDATION` solo
   como comando puntual de Roger, no como default en `package.json`).
5. **Route handlers fuera de `[locale]`** (`api/auth`, `api/trpc`, `api/webhooks`,
   `api/cron`): confirmar que la build no los somete al middleware de locale.

Registrar en la descripción del PR la tabla de rutas del output de `next build`
(ruta → Static/Dynamic → tamaño), con `/` y `/en` como **estáticas**.

### 2. Auditoría del contrato en el `appRouter`

Recorrer todos los routers registrados en `src/server/api/root.ts` y verificar por
procedure:

- Retorna `TrpcResponse` construida con `ok`/`fail` de `src/server/api/contract.ts`
  (nunca objetos literales ad-hoc, nunca `throw` de errores de dominio).
- `catch (error: unknown)` + `normalizeError`; cero `any`, cero `@ts-ignore`, cero stack
  traces o mensajes de Prisma/Stripe hacia el cliente.
- El código de error está en `ERROR_CODES` o es un código de dominio del módulo declarado
  en su `*.schema.ts`, y tiene clave en `src/messages/{es,en}/errors.json`
  (o en el namespace del módulo si se optó por sobrescribirlo).
- Excepción única y documentada: las guardas de rol de `trpc.ts` lanzan `TRPCError`
  UNAUTHORIZED/FORBIDDEN (`spec/00-foundations.md` §5).

### 3. Cierre

Tras los fixes, correr una secuencia final: `pnpm typecheck`, `pnpm check` y `pnpm build`.
No crear tests, archivos `*.test-d.ts` ni scripts de auditoría permanentes.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Los fixes de build no pueden cambiar comportamiento de negocio: si la build revela un
  problema de diseño (p. ej. una página que no puede ser estática), se documenta, no se
  parchea con `any` ni con `force-dynamic` indiscriminado.

## Criterios de aceptación

- [ ] `pnpm build` en verde, con `/` y `/en` prerenderadas como estáticas.
- [ ] Tabla de rutas del build (Static/Dynamic) incluida en el PR.
- [ ] Matriz router.procedure → helper de retorno/códigos incluida en el PR; todas las
      procedures cumplen `TrpcResponse` sin crear tests automatizados.
- [ ] Cero `any`/`@ts-ignore` nuevos; cero mensajes crudos de Prisma/Stripe al cliente.
- [ ] La build conserva marca solo en landing y zinc en dashboard/admin.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

La build requiere las variables de `.env` validadas por `src/env.js`. Para servir la
build ya generada sin repetirla:

```bash
pnpm start
```
