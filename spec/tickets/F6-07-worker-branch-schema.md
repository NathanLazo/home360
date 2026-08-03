# [F6-07] Validar el contrato Worker–Branch requerido por team

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §2 (tabla de team con columna "sucursal");
  `spec/08-business-model-alignment.md` D5; `spec/tickets/F0-12-marketplace-schema-extensions.md`
- **Depende de**: `F0-12`
- **Tamaño estimado**: S

## Contexto

La spec F6 original parecía requerir una migración para la columna «sucursal», pero D5 y
`F0-12` ya incorporan `Worker.branchId`, ambos lados de la relación, índices y los campos
ricos del trabajador en la **migración inicial**. Repetir el cambio aquí solaparía scopes
y produciría una segunda migración innecesaria. Este ticket es un gate pequeño: confirma
que el contrato de F0 está disponible antes de construir router y UI.

## Alcance

No crea ni modifica archivos cuando F0-12 está completo.

Fuera de alcance: corregir `prisma/schema.prisma` o seed (pertenecen a F0-12/F0-11);
router/UI de team (F6-08/F6-09); migraciones o comandos de datos.

## Detalle técnico

Verificar en `prisma/schema.prisma`:

```prisma
branchId   String?
branch     Branch?   @relation(fields: [branchId], references: [id], onDelete: SetNull)

@@index([branchId])
```

Y en `Branch`, el lado inverso:

```prisma
workers    Worker[]
```

También confirmar que `Worker` conserva `businessId`, `fullName`, `services` y los campos
de D5 (`specialty`, `availability`, `ratingAvg`, `invitedEmail`, `invitationStatus`), sin
redefinirlos en F6.

Ejecutar únicamente:

```bash
pnpm prisma generate
```

Si falta cualquier campo o relación, **no arreglarlo en F6**: reportar bloqueado `F0-12`.
F6-08 no se implementa ni se prueba manualmente contra BD hasta que Roger confirme la
migración inicial.

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

- [ ] `pnpm prisma generate` sin errores; `Worker.branchId`/`Worker.branch` disponibles
      en el cliente tipado y `Branch.workers` presente desde F0-12.
- [ ] `@@index([branchId])` presente; relación con `onDelete: SetNull`.
- [ ] No se creó migración ni se modificó schema/seed desde este ticket.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Roger confirma que la migración inicial de F0-12 está aplicada. Este ticket no agrega
ningún comando de BD.
