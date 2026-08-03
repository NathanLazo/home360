# [F7-02] Procedures `corporate` y `activeCorporate` en la jerarquía de roles

## Metadatos

- **Fase**: F7 — Cuentas corporativas B2B
- **Spec origen**: `spec/09-corporate-accounts.md` §4 · `spec/00-foundations.md` §5
- **Depende de**: `F7-01`
- **Tamaño estimado**: S (< 1 h)

## Contexto

Añade el escalón corporativo al árbol de procedures existente, con la misma disciplina que
`businessProcedure`: rol verificado en servidor, tenant resuelto **desde la sesión** y
`ctx` enriquecido con narrowing real, sin casts ni `any`.

Es un ticket pequeño pero es la superficie de seguridad de toda la fase: si `ctx` se resuelve
mal aquí, cada procedure de F7 filtra datos de otra empresa.

## Alcance

Modificar:

- `src/server/api/trpc.ts` — `corporateProcedure` y `activeCorporateProcedure`.
- `src/lib/auth/role-home.ts` — mapear `UserRole.CORPORATE` a `/corporate`; el `switch`/mapa
  debe ser exhaustivo para que un rol nuevo no caiga silenciosamente en `/`.
- `src/server/auth/config.ts` y `src/server/auth/edge-config.ts` — solo si contienen listas
  manuales de roles, ampliar el narrowing con `CORPORATE` sin cambiar providers ni sesión.

Fuera de alcance: routers que las consumen (F7-03, F7-05); middleware de rutas (F7-06 protege
`/corporate` en su layout, con el patrón de `F1-06`).

## Detalle técnico

```text
protectedProcedure
└─ corporateProcedure          # role === CORPORATE → ctx.corporateAccount no-nulo
   └─ activeCorporateProcedure # además status === ACTIVE
```

- `corporateProcedure` hace **una** consulta por request:
  `db.corporateAccount.findUnique({ where: { ownerId: ctx.session.user.id }, select: { id, name, tier, status, commissionPct, maxLocations } })`.
  Sin cuenta → `FORBIDDEN` 403, nunca `NOT_FOUND`: no se revela si el recurso existe.
- Rol distinto de `CORPORATE` → `FORBIDDEN` 403 con el mismo mensaje genérico que el resto de
  la jerarquía. Un ADMIN tampoco pasa por aquí: si necesita ver una cuenta, usa
  `admin.corporate` (F7-03).
- `activeCorporateProcedure` añade `status === ACTIVE`; una cuenta `PENDING` solo puede leer
  su propio estado, y `SUSPENDED`/`CANCELLED` quedan en solo lectura.
- El tipo de `ctx.corporateAccount` se infiere del `select`; no se declara una interfaz
  paralela que pueda desincronizarse.
- Las guardas de infraestructura lanzan `TRPCError({ code: "FORBIDDEN" })`, igual que F0-05;
  no intentan envolver el error de autorización en `TrpcResponse`. Todas las procedures de
  dominio que se monten encima sí retornan exactamente
  `{ result, error, status, message }`.
- `activeCorporateProcedure` permite únicamente `ACTIVE`. `PENDING`, `SUSPENDED` y
  `CANCELLED` reciben el mismo 403 genérico; las lecturas bajo `corporateProcedure` siguen
  disponibles para mostrar estado, membresía e historial.
- Actualizar la fuente única de redirects por rol evita que login, middleware o layouts
  envíen a un usuario CORPORATE a la landing. No duplicar mapas de roles en F7-06.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Tenant desde sesión, nunca desde input; filtrado dentro de la query Prisma.
- TypeScript estricto: sin `any`, sin casts; narrowing real.
- Identificadores en inglés.
- BD: el agente solo puede ejecutar `pnpm prisma generate`.

## Criterios de aceptación

- [ ] `ctx.corporateAccount` es no-nulo dentro de ambas procedures, sin casts.
- [ ] Rol incorrecto y cuenta inexistente responden 403 idénticos.
- [ ] Login y redirecciones de ruta envían `CORPORATE` a `/corporate` conservando locale.
- [ ] El mapeo de los cinco roles (`ADMIN`, `BUSINESS`, `CORPORATE`, `CUSTOMER`, `WORKER`)
      es exhaustivo y no usa `default`.
- [ ] Una sola consulta de tenant por request.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
