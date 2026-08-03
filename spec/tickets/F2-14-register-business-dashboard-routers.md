# [F2-14] Registra los routers F2 en `appRouter`

## Metadatos

- **Fase**: F2 — Dashboard de negocio
- **Spec origen**: `spec/02-business-dashboard.md` §0–§5; `spec/README.md` §Stack
- **Depende de**: F2-03, F2-05, F2-07, F2-10, F2-12
- **Tamaño estimado**: S (< 1 h)

## Contexto

Los cinco tickets backend F2 modificaban en paralelo `src/server/api/root.ts`, aunque el
README recomienda ejecutar sus cadenas por módulo en paralelo. Este ticket concentra ese
único punto de integración después de que existan los routers, elimina scopes solapados y
deja disponible el tipo completo de `appRouter` antes de construir las vistas cliente.
`product.importCsv` se agrega después en F2-09 al router ya registrado y no requiere volver
a tocar el root.

## Alcance

Modificar exclusivamente:

- `src/server/api/root.ts`

Fuera de alcance: crear o cambiar procedures, servicios, schemas Zod, UI, mensajes,
Prisma o datos.

## Detalle técnico

Importar y registrar exactamente estos routers bajo nombres estables:

```ts
export const appRouter = createTRPCRouter({
  // routers existentes de F0/F1 permanecen intactos
  dashboard: dashboardRouter,
  service: serviceRouter,
  product: productRouter,
  branch: branchRouter,
  order: orderRouter,
});
```

- Conservar todas las entradas existentes; no renombrar routers de otras fases.
- Resolver imports directamente desde `src/server/api/routers/*.ts`, sin barrel nuevo.
- No envolver ni transformar procedures: cada router ya devuelve
  `TrpcResponse<TResult, TError>`.
- Confirmar que el tipo exportado `AppRouter` incluye los cinco namespaces y que el cliente
  tRPC puede inferir sus inputs y sobres de respuesta sin casts.

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

- [ ] `src/server/api/root.ts` es el único archivo modificado por este ticket.
- [ ] `dashboard`, `service`, `product`, `branch` y `order` aparecen una sola vez en
      `appRouter`; los routers previos siguen registrados.
- [ ] `AppRouter` infiere las cinco APIs completas sin `any` ni casts.
- [ ] `pnpm typecheck` · `pnpm check` · `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
