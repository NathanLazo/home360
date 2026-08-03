# [F6-11] Construir el módulo UI `/dashboard/settings`

## Metadatos

- **Fase**: F6 — Landing + pulido final
- **Spec origen**: `spec/06-landing-polish.md` §2 (`/dashboard/settings`);
  `spec/02-business-dashboard.md` §0 (prefetch + HydrateClient, patrón de módulo)
- **Depende de**: `F6-10`, `F2-01` (layout/sidebar) y `F0-08` (`PageHeader`)
- **Tamaño estimado**: M

## Contexto

Pantalla de configuración del negocio: perfil (nombre, tipo, garantía en solo lectura,
notas) y cuenta del dueño (nombre + cambio de contraseña con verificación de la actual).
A diferencia de los módulos de tabla, aquí el patrón es de formularios en cards.

Decisión resuelta aquí: el formulario de contraseña añade un campo "confirmar nueva
contraseña" **solo en cliente** (el router F6-10 recibe únicamente
`{ currentPassword, newPassword }`); la coincidencia se valida con Zod `refine` antes de
mutar.

## Alcance

Crear/modificar:

- `src/app/[locale]/dashboard/settings/page.tsx` · `loading.tsx` · `error.tsx`
- `src/app/[locale]/dashboard/settings/_components/`:
  `settings-view.tsx`, `business-profile-form.tsx`, `guarantee-readonly-field.tsx`,
  `owner-account-form.tsx`, `change-password-form.tsx`, `settings.schema.ts`,
  `settings.types.ts`, `use-settings-mutations.ts`
- Item "Configuración"/"Settings" en el sidebar del dashboard (icono lucide `Settings`,
  ruta `/dashboard/settings`, al final de la lista).
- Claves nuevas en `src/messages/{es,en}/dashboard.json` (namespace `settings`).

Fuera de alcance: router (F6-10); settings de admin W13; cambio de email/garantía.

## Detalle técnico

- `page.tsx`: prefetch `api.businessSettings.get` + `HydrateClient` → `SettingsView`.
- `settings-view.tsx` (`"use client"`): `useQuery`; dos secciones en cards apiladas
  (máx ~640 px de ancho): "Perfil del negocio" y "Cuenta del dueño".
- `business-profile-form.tsx`: Inputs nombre del negocio, Select tipo
  (SERVICES/PRODUCTS/MIXED traducidos), `guarantee-readonly-field.tsx` (valor de
  `guaranteeType` traducido + nota "Cambiarla requiere aprobación del equipo HOME360" —
  campo deshabilitado, `aria-describedby` a la nota) y Textarea `guaranteeNotes`.
  Envía solo `updateBusinessProfile`. Botón "Guardar cambios" deshabilitado sin cambios.
- `owner-account-form.tsx`: nombre del dueño en un submit independiente hacia
  `updateOwner`; sigue disponible para cuentas PENDING/SUSPENDED.
- `change-password-form.tsx`: Inputs `type="password"` actual / nueva / confirmar
  (`autocomplete`: `current-password` / `new-password` / `new-password`). Schema en
  `settings.schema.ts`:

  ```ts
  changePasswordFormSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
    .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], … })
    .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], … });
  ```

  Errores bajo el input; `CURRENT_PASSWORD_INVALID` del servidor se muestra bajo el campo
  de contraseña actual además del toast. Al éxito: reset, `signOut` y redirect localizado
  a `/login`, porque F6-10 invalida las sesiones; nunca conservar valores.
- `use-settings-mutations.ts`: `updateBusinessProfile`, `updateOwner` y `changePassword`
  con toasts por código e
  `invalidate` de `businessSettings.get`.
- `loading.tsx`: skeleton de dos cards con filas de campos. `error.tsx`: mensaje + retry.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; tipos inferidos de Zod/Prisma/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad, dentro de `_components/`.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.
- Sin animaciones (dashboard sobrio); labels asociados a cada input (a11y).

## Criterios de aceptación

- [ ] Perfil editable y garantía visible pero inmutable, con su nota explicativa.
- [ ] Cambio de contraseña: actual incorrecta → error bajo el campo; éxito → toast y form
      limpio + salida a login; confirmación y diferencia respecto de la actual validadas.
- [ ] Perfil comercial y cuenta del dueño son submits independientes; la UI comunica
      cuando el perfil comercial no puede editarse por estado del negocio.
- [ ] Formularios operables por teclado; autocomplete correcto; estados
      loading/error presentes.
- [ ] Copy completo es/en; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
