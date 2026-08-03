# [F6-10] Implementar el router `businessSettings` (perfil + cambio de contraseña)

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §2 (`/dashboard/settings`);
  `spec/01-auth.md` §1 (`password.ts`); `spec/00-foundations.md` §4 (códigos de dominio)
- **Depende de**: `F1-09` (password service + invalidación JWT con
  `User.sessionsValidFrom`), `F2-01` (contexto/layout de negocio) y `F6-08`
  (serializa el registro compartido en `src/server/api/root.ts`)
- **Tamaño estimado**: M

## Contexto

`get`/`update` del perfil del negocio y datos del dueño, incluido cambio de contraseña
verificando la actual. Problemas detectados y resueltos aquí:

1. **Coherencia con F1**: F1 declara `password.ts` como *único* lugar que toca bcrypt
   (cost 12). Resolución: `changePassword` usa `verifyPassword`/`hashPassword` de ese
   servicio; prohibido importar `bcryptjs` aquí.
2. **`passwordHash` nullable**: `User.passwordHash` es `String?` (OAuth). Por F1 los
   dueños de negocio siempre se crean vía `/register` con contraseña, pero el caso
   `null` se maneja defensivamente con el mismo código de error (sin revelar el motivo).
3. **Procedures**: lectura, dueño y contraseña son operaciones de cuenta bajo
   `businessProcedure`; los campos comerciales del negocio se actualizan con
   `activeBusinessProcedure`. Así una cuenta suspendida puede proteger su acceso sin
   modificar el perfil público aprobado.
4. **`guaranteeType` solo lectura**: `update` no la acepta en el input (cambiarla exige
   re-aprobación admin, fuera de alcance); solo `guaranteeNotes` es editable.

## Alcance

Crear/modificar:

- `src/server/services/settings/business-settings.ts` (nuevo)
- `src/server/api/routers/business-settings.ts` (nuevo; key `businessSettings` en root)
- `src/server/api/root.ts` (registrar router)
- `src/messages/{es,en}/errors.json`: clave `CURRENT_PASSWORD_INVALID`.

Fuera de alcance: UI (F6-11); cambio de `guaranteeType`; cambio de email; recuperación de
contraseña; settings de plataforma (W13, F5).

## Detalle técnico

Código de dominio del módulo (patrón F0 §4): en el schema del servicio se declara
`type SettingsErrorCode = ErrorCode | "CURRENT_PASSWORD_INVALID"`.

| Procedure | Proc | Input (Zod) | Result / Errores |
|-----------|------|-------------|------------------|
| `get` (query) | business | — | `BusinessSettings` |
| `updateBusinessProfile` (mutation) | active | `{ businessName: min(2), businessType: nativeEnum(BusinessType), guaranteeNotes?: string.max(500) \| null }` | `{ id }` |
| `updateOwner` (mutation) | business | `{ ownerName: min(2) }` | `{ id }` |
| `changePassword` (mutation) | business | `{ currentPassword: min(1), newPassword: min(8) }` | `null` (204) · `CURRENT_PASSWORD_INVALID` (400) |

```ts
type BusinessSettings = {
  business: { name: string; type: BusinessType;
              guaranteeType: GuaranteeType; guaranteeNotes: string | null };
  owner: { name: string | null; email: string | null };
};
```

Servicio `business-settings.ts` (recibe `db` y `businessId`/`ownerId` desde `ctx`):

- `getSettings`: `business.findUniqueOrThrow({ where: { id }, select: { name, type,
  guaranteeType, guaranteeNotes, owner: { select: { name, email } } } })`.
- `updateBusinessProfile`: `business.update({ where: { id: businessId } })` para
  nombre/tipo/notas. `guaranteeType` jamás aparece en input ni `data`.
- `updateOwner`: `user.update({ where: { id: ownerId } })` para `ownerName`.
- `changePassword(db, ownerId, input)`:
  1. `user.findUniqueOrThrow({ where: { id: ownerId }, select: { passwordHash } })`.
  2. `passwordHash === null` o `!(await verifyPassword(input.currentPassword, hash))` →
     `fail("CURRENT_PASSWORD_INVALID", 400, "current password check failed")` (mismo
     código en ambos casos; no se distingue el motivo).
  3. El schema `.refine` exige que nueva y actual difieran.
  4. `user.update({ data: { passwordHash: await hashPassword(input.newPassword),
     sessionsValidFrom: new Date() } })` → `ok(null, "password updated", 204)`.
     El callback JWT de F1 invalida tokens anteriores según el contrato de F0-12.
  5. Nunca loggear contraseñas ni hashes.

Verificación manual/código: contraseña incorrecta y hash null producen el mismo código;
éxito cambia hash + `sessionsValidFrom`; inputs `.strict()` rechazan `guaranteeType`;
un negocio suspendido recibe `FORBIDDEN` al actualizar el perfil comercial, pero puede
actualizar dueño/contraseña.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- bcrypt solo vía `src/server/services/auth/password.ts` (regla F1).

## Criterios de aceptación

- [ ] `get`/`updateBusinessProfile`/`updateOwner`/`changePassword` registrados con los códigos de la tabla;
      `errors.json` es/en incluye `CURRENT_PASSWORD_INVALID`.
- [ ] `guaranteeType` imposible de modificar por API.
- [ ] Cambio de contraseña rechaza reutilizar la actual e invalida JWT previos mediante
      `sessionsValidFrom`; la sesión actual sale en el siguiente refresh.
- [ ] Separación observable: perfil comercial requiere negocio ACTIVE; dueño/contraseña no.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
