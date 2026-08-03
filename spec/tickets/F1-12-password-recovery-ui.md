# [F1-12] Construir UI de solicitud y restablecimiento de contraseña

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §4 (enlace W2) · cierre del hueco
  `spec/tickets/F1-findings.md` M1
- **Depende de**: `F1-07` (login y navegación i18n), `F1-09` (schemas, procedures y
  códigos estables)
- **Tamaño estimado**: M (1–3 h)

## Contexto

F1-09 deja autocontenidos el dominio, correo, procedures y revocación de sesiones. Este
ticket completa únicamente la superficie pública: solicitud neutral y formulario de nueva
contraseña. La separación evita que infraestructura de seguridad, integración Resend y dos
pantallas cliente formen un ticket mayor a 6 horas.

## Alcance

Crear:

- `src/app/[locale]/(public)/forgot-password/page.tsx`
- `src/app/[locale]/(public)/forgot-password/_components/forgot-password-form.tsx`
- `src/app/[locale]/(public)/reset-password/page.tsx`
- `src/app/[locale]/(public)/reset-password/_components/reset-password-form.tsx`

Modificar:

- `src/messages/es/auth.json`
- `src/messages/en/auth.json`

Fuera de alcance: tokens, Prisma, Resend, callbacks JWT, rate limiting (F1-11), verificación
de email y cambio de contraseña desde un perfil autenticado.

## Detalle técnico

### `/forgot-password`

`page.tsx` es Server Component y compone la misma carcasa pública de W2 con título,
descripción, `<ForgotPasswordForm />` y enlace a `/login`, usando `Link` de
`~/i18n/navigation`.

`forgot-password-form.tsx` es cliente:

- Input email con `autoComplete="email"`, label y error unidos por `aria-describedby`.
- Valida con `requestPasswordResetSchema`; llama
  `api.auth.requestPasswordReset.useMutation({ email, locale })`.
- Para cualquier resolución HTTP normal muestra exactamente la confirmación neutral:
  “Si el correo está registrado y admite contraseña, recibirás un enlace”. No distingue
  cuenta inexistente, OAuth-only, rate limit ni fallo de proveedor.
- Un fallo de transporte inesperado usa copy genérico traducido y permite reintentar; nunca
  muestra `error.message`, stack ni `data.message`.
- Mientras envía, deshabilita submit y expone estado accesible.

### `/reset-password`

`page.tsx` recibe `searchParams: Promise<{ token?: string }>` y pasa el token como
`string | null`; no lo registra, no lo inserta en HTML fuera del prop y no lo copia a
analytics. Token ausente renderiza el mismo estado que `INVALID_TOKEN`.

`reset-password-form.tsx` es cliente:

- Password y confirmación con `autoComplete="new-password"`; usa
  `resetPasswordSchema.safeParse` antes de mutar.
- Llama `api.auth.resetPassword` con el token, password y confirmación.
- `VALIDATION_ERROR` mantiene el formulario y enfoca el primer campo inválido.
- `INVALID_TOKEN` reemplaza el formulario por un estado traducido con enlace a
  `/forgot-password`; no distingue inexistente, usado o vencido.
- Éxito limpia ambos estados de contraseña, muestra toast traducido y hace
  `router.replace("/login")`. No inicia sesión automáticamente.
- Cualquier código no reconocido se mapea a `errors.UNKNOWN_ERROR`. Nunca renderiza
  `message` del servidor.

### i18n

Agregar en ambos `auth.json`:

- `forgotPassword.title`, `description`, `emailLabel`, `emailPlaceholder`, `submit`,
  `confirmation`, `transportError`, `backToLogin`.
- `resetPassword.title`, `description`, `passwordLabel`, `confirmPasswordLabel`, `submit`,
  `success`, `invalidToken`, `requestAgain`, `validation.passwordLength`,
  `validation.passwordMismatch`.

Todo copy visible, incluidos estados de carga, errores, links y toasts, sale de next-intl.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>`: consumir `result`, `error`, `status`, `message`
  sin alterar su forma; la UI traduce `error` y nunca muestra `message`.
- TypeScript estricto: sin `any`, casts amplios ni `@ts-ignore`; tipos inferidos de
  Zod/tRPC.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Componentización: cada página compone y cada form concentra solo su interacción local.
- **Sin pruebas automatizadas**: no crear `*.test.ts` ni configuración de test.
- BD: el agente no ejecuta migraciones, seed, SQL ni comandos de datos.

## Criterios de aceptación

- [ ] Solicitar con email existente, inexistente u OAuth-only produce la misma confirmación
      visible.
- [ ] Token ausente, usado, vencido o inexistente muestra un único estado
      `invalidToken`.
- [ ] Password corta o confirmación distinta no envían la mutation y enfocan el campo.
- [ ] Éxito limpia secretos en memoria, muestra toast y reemplaza la ruta por `/login` sin
      iniciar sesión.
- [ ] Navegación, labels, errores, estados y toasts están completos en es/en; ningún
      `message` de servidor se pinta.
- [ ] Flujo navegable con teclado, foco visible y asociaciones label/error correctas.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Verificación manual con un correo de Resend autorizado y variables de F1-09. El agente no
ejecuta comandos de BD.
