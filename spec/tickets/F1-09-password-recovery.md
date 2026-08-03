# [F1-09] Recuperación de contraseña (solicitud, correo y restablecimiento)

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §4 (enlace de recuperación) ·
  `spec/08-business-model-alignment.md` D9 · hueco `F1-findings.md` M1
- **Depende de**: `F1-01` (`passwordSchema`, códigos auth), `F1-02`, `F1-03`, `F1-04`,
  `F1-06`, `F1-07` (archivo del login y `/post-login`), `F0-12`
  (`PasswordResetToken`, `User.sessionsValidFrom`; migración aplicada por Roger), `F0-13`
  (`EmailClient` y configuración Resend)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Ninguna fase del plan contemplaba qué pasa cuando un dueño de negocio olvida su contraseña:
hoy quedaría fuera de su cuenta de forma permanente, sin ruta de salida. Como el login es por
credenciales (Google solo crea clientes), esto no es un extra: es parte del mínimo viable de
autenticación.

El adaptador reutilizable y Resend ya pertenecen a F0-13 (D9). Este ticket crea únicamente
el servicio de dominio de recuperación y recibe `EmailClient` por inyección; no vuelve a
declarar el SDK, variables ni contrato del proveedor.

## Alcance

Crear:

- `src/server/services/email/send-password-reset.ts`
- `src/server/services/auth/password-reset.ts` (dominio: emitir, validar, consumir)
- `src/schemas/auth/password-reset.schema.ts`

Modificar:

- `src/server/api/routers/auth.ts` (`requestPasswordReset`, `resetPassword`)
- `src/server/auth/types.ts`, `src/server/auth/config.ts` (marca de sesión invalidada)
- `src/server/auth/require-role.ts`, `src/server/api/trpc.ts` (rechazar JWT revocado)
- `src/app/[locale]/(public)/post-login/page.tsx` (no aceptar JWT revocado)
- `src/env.js` y `.env.example` (solo `APP_URL`; correo pertenece a F0-13)
- `src/messages/{es,en}/auth.json` (solo namespace `passwordResetEmail`) y `errors.json`

Fuera de alcance: verificación de correo al registrarse, cambio de contraseña desde el perfil
(eso vive en `F6-10`), plantillas de correo elaboradas y las pantallas públicas
(`/forgot-password` y `/reset-password`, ticket F1-12).

## Detalle técnico

### Procedures (`publicProcedure`, ambas)

| Procedure | Input | Result |
|-----------|-------|--------|
| `requestPasswordReset` | `{ email, locale: "es" \| "en" }` | **siempre** `{ result: null, error: null, status: 200, message: "If the account is eligible, a reset email was sent" }` |
| `resetPassword` | `{ token, password, confirmPassword }` | `{ userId }` · `INVALID_TOKEN` (400) · `VALIDATION_ERROR` (400) |

`requestPasswordReset` responde éxito **siempre**, exista o no la cuenta. Devolver
"ese correo no existe" convierte el formulario en un oráculo para enumerar usuarios, que es
exactamente el ataque que este endpoint invita. La UI dice "si el correo está registrado,
te enviamos un enlace" y eso es literalmente cierto.

Flujo de emisión:

1. Normalizar el correo (trim + lowercase) y buscar usuario **con** `passwordHash` (una
   cuenta creada solo con Google no tiene contraseña que restablecer: se responde igual, sin
   enviar nada).
2. Invalidar tokens previos vivos del usuario (`usedAt: now`): un solo enlace activo a la vez.
3. Generar token con `crypto.randomBytes(32).toString("base64url")`; persistir **solo** su
   SHA-256 en `tokenHash`, con `expiresAt = now + 1 h`.
4. Enviar el correo con el enlace `/{locale}/reset-password?token=<plano>`, en el idioma
   activo.

La URL se construye con `new URL` desde `env.APP_URL` y el helper de navegación i18n; nunca
desde `Host`/`x-forwarded-host`. Para `es` usa `/reset-password` y para `en`,
`/en/reset-password`. `APP_URL` no lleva path ni slash final.

El endpoint mantiene idénticos `result/error/status/message` para cuenta inexistente,
OAuth-only, envío exitoso y fallo de Resend. Aplica un piso de duración común antes de
responder para reducir el canal temporal; no promete tiempo idéntico de red. Si Resend falla,
marca el token recién creado como usado y registra solo un código técnico, nunca email ni
token. F1-11 añade el límite de abuso sin cambiar esta respuesta.

Flujo de consumo (`resetPassword`), dentro de una transacción:

1. Validar con `resetPasswordSchema`: token no vacío, `passwordSchema`, confirmación igual.
   Fallo → `VALIDATION_ERROR`, sin tocar BD.
2. Hashear el token recibido y buscar por `tokenHash` con `select` mínimo.
3. Rechazar si no existe, si `usedAt !== null` o si `expiresAt <= now` → `INVALID_TOKEN` (el
   mismo código para los tres casos: distinguirlos no ayuda al usuario y sí al atacante).
4. Hashear password fuera de la transacción. Dentro de una transacción, reclamar el token
   con `updateMany({ where: { id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })`.
   Si `count !== 1`, devolver `INVALID_TOKEN`; esto evita doble consumo concurrente.
5. En la misma transacción actualizar `User.passwordHash` y
   `sessionsValidFrom: now`. Éxito → `ok({ userId }, "Password reset", 200)`.

### Invalidación real de JWT

`sessionsValidFrom` no sirve si solo se escribe. La config Node completa sobrescribe el
callback `jwt` edge-safe:

- Primer sign-in: `token.authIssuedAtMs = Date.now()` y `token.authInvalidated = false`.
- En usos posteriores con `token.sub`, consulta `User.sessionsValidFrom` con `select`
  explícito. Si el usuario no existe o `sessionsValidFrom.getTime() >
  token.authIssuedAtMs`, marca `authInvalidated = true`.
- Si un JWT anterior al despliegue no trae `authIssuedAtMs`, se marca inválido y exige
  iniciar sesión otra vez; no usar `iat` como fallback silencioso.
- `types.ts` aumenta `JWT` con ambos campos y `Session["user"]` con
  `authInvalidated: boolean`; `session` copia la marca.
- `protectedProcedure` trata una sesión marcada como `UNAUTHORIZED`, antes de cualquier
  query de tenant. `requireRole` y `/post-login` la tratan como sesión ausente y redirigen a
  `/login`.

El middleware edge no consulta BD y puede dejar pasar la cookie hasta el layout; eso es
aceptable porque es cortesía UX. Layout y tRPC son las barreras reales y sí rechazan el JWT
en la misma petición. No comparar solo contra `iat` (segundos): la marca propia en
milisegundos evita invalidar sesiones nuevas por redondeo.

### Schemas y adaptador de correo

`password-reset.schema.ts` exporta `requestPasswordResetSchema`,
`resetPasswordTransportSchema` (solo forma/tipos) y `resetPasswordSchema` (política completa
y confirmación). La procedure usa el transport schema y el servicio hace `safeParse` del
schema completo para poder retornar `VALIDATION_ERROR` dentro de `TrpcResponse`.

Consumir los tipos concretos `EmailMessage`, `EmailSendResult` y `EmailClient` de F0-13.
`send-password-reset.ts` recibe el cliente por parámetro, genera subject/text/html traducidos
y escapa cualquier valor interpolado; no contiene lógica de tokens ni importa `resend`.

Claves i18n exactas de correo en ambos locales:
`passwordResetEmail.subject`, `intro`, `cta`, `expires`. `errors.json` añade
`INVALID_TOKEN`; `VALIDATION_ERROR` ya existe. Las claves de las pantallas pertenecen a
F1-12.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; errores como códigos estables.
- TypeScript estricto: sin `any`, sin `@ts-ignore`.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Nunca registrar en logs el token plano, el correo completo ni el hash de contraseña.
- El agente **no** genera ni fija contraseñas de usuarios reales.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `requestPasswordReset` responde con el mismo cuerpo y status exista o no la cuenta,
      sea OAuth-only o falle Resend; tiene piso temporal documentado, sin afirmar igualdad
      imposible del tiempo de red.
- [ ] El token plano no se persiste en ningún lado; solo su hash.
- [ ] Token usado, vencido o inexistente → `INVALID_TOKEN`, sin filtrar cuál de los tres.
- [ ] Solicitar un enlace nuevo invalida el anterior.
- [ ] Tras restablecer, las sesiones previas dejan de ser válidas.
- [ ] Dos consumos concurrentes del mismo token producen un solo éxito.
- [ ] Solo `email-client.ts` importa `resend`; `APP_URL` es la única base de los enlaces.
- [ ] Procedures devuelven exactamente `{ result, error, status, message }`; la UI traduce
      códigos y no muestra `message`.
- [ ] El ticket no crea UI; los dos flujos de dominio y el adaptador quedan consumibles por
      F1-12.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

Variables nuevas en `.env`:

```bash
RESEND_API_KEY="re_..."
EMAIL_FROM="HOME360 <no-reply@tudominio.com>"
APP_URL="http://localhost:3000"
```

Roger verifica manualmente solicitud, correo, expiración, doble uso e invalidación de una
sesión abierta. El agente no ejecuta migraciones, seed, SQL ni comandos de datos.
