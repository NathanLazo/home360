# [F1-11] Rate limiting en login, registro y recuperación

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: hueco detectado en `F1-findings.md` M3 (ninguna spec lo cubría)
- **Depende de**: `F1-03` (NextAuth), `F1-04` (registro), `F1-08` (formulario de registro),
  `F1-09` (recuperación), `F0-12` (`AuthAttempt`)
- **Tamaño estimado**: M (1–3 h)

## Contexto

Los tres endpoints de autenticación quedan expuestos a fuerza bruta y a abuso: probar
contraseñas contra `authorize`, enumerar correos con el registro y usar la recuperación como
máquina de enviar correos a terceros. Ninguna spec lo contemplaba.

**Decisión de infraestructura**: se implementa con una **ventana deslizante en Postgres**
(tabla `AuthAttempt`, `F0-12`), no con Redis. El stack no tiene Redis, y un contador en
memoria es inútil en serverless porque cada instancia contaría por separado — daría una falsa
sensación de protección. El costo es una escritura por intento; si el volumen algún día lo
justifica, se cambia el adaptador por Upstash sin tocar a los llamadores.

## Alcance

Crear:

- `src/server/services/auth/rate-limit.ts`

Modificar:

- `src/server/auth/config.ts` (`authorize`)
- `src/server/services/auth/password.ts` (comparación dummy para cuentas inexistentes/OAuth-only)
- `src/server/api/routers/auth.ts` (`registerBusiness`, `requestPasswordReset`)
- `src/messages/{es,en}/errors.json` (clave `TOO_MANY_REQUESTS`)
- `src/app/[locale]/(public)/register/_components/register-form.tsx` (mensaje 429)

Fuera de alcance: rate limiting global de la app o del router tRPC, protección de webhooks
(Stripe ya firma), CAPTCHA.

## Detalle técnico

```ts
type AuthAction = "login" | "register" | "password-reset";
type RateLimitRule = {
  action: AuthAction;
  identifier: string;
  max: number;
  windowMinutes: number;
};
type RateLimitReservation =
  | { allowed: true; attemptIds: string[] }
  | { allowed: false; retryAfterSeconds: number };

reserveRateLimitAttempts(
  db: PrismaClient,
  rules: readonly RateLimitRule[],
): Promise<RateLimitReservation>;

releaseRateLimitAttempts(
  db: PrismaClient,
  attemptIds: readonly string[],
): Promise<void>;
```

Reglas iniciales, pensadas para molestar a un atacante sin estorbar a una persona real:

| Acción | Límite | Ventana | Identificador |
|--------|--------|---------|---------------|
| `login` | 10 | 15 min | correo normalizado |
| `login` | 30 | 15 min | IP |
| `register` | 5 | 60 min | IP |
| `password-reset` | 3 | 60 min | correo normalizado |
| `password-reset` | 10 | 60 min | IP |

Detalles que definen si esto sirve o es decorativo:

- Login y recuperación aplican **ambas** reglas (cuenta + IP). La regla por cuenta frena IPs
  rotativas; la regla por IP reduce el bloqueo dirigido de una cuenta y el abuso con emails
  aleatorios. Registro usa IP porque todavía no existe una cuenta.
- Nunca se persiste email ni IP en claro. `identifier` es
  `email:<HMAC-SHA256(AUTH_SECRET, normalizedEmail)>` o
  `ip:<HMAC-SHA256(AUTH_SECRET, normalizedIp)>`; usar `createHmac` de `node:crypto` y
  comparación normal de strings de digest. No agregar otro secreto.
- En Vercel, la IP se lee primero de `x-vercel-forwarded-for`; fallback a
  `x-forwarded-for` (primer valor) y luego `x-real-ip`. Si no hay ninguna, se usa
  `"unknown"` y se registra igual. Si el despliegue futuro permite acceso directo sin un
  proxy que sanee esos headers, la regla por IP no se considera confiable y debe sustituirse
  por el header verificado de ese proveedor.
- En Credentials, leerla del parámetro `request.headers` que recibe `authorize(credentials,
  request)` en beta.25. En tRPC, leerla de `ctx.headers` (ya forma parte de
  `createTRPCContext`), nunca desde input del cliente. Centralizar parsing/normalización en
  `clientIpFromHeaders(headers: Headers)`.
- La reserva es atómica: dentro de una transacción `Serializable`, contar cada ventana y
  crear una fila por regla solo si todas permiten. Reintentar `P2034` hasta 3 veces; si se
  agotan los reintentos, denegar (fail closed). Un `count` seguido de `create` sin
  aislamiento permite saltarse el límite con concurrencia y está prohibido.
- **Login reserva antes de bcrypt y libera sus filas si el login es correcto**; así solo los
  fallos consumen cuota, pero las solicitudes concurrentes no atraviesan el límite. Si falla,
  conserva la reserva. `releaseRateLimitAttempts` solo borra los IDs que devolvió esa misma
  reserva.
- Al superar el límite, `authorize` devuelve `null`: Credentials mantiene el error genérico
  y **no puede** transportar un 429 con el contrato tRPC. Por ello login no muestra
  `TOO_MANY_REQUESTS`; hacerlo contradice `authorize → null` y filtra estado del limitador.
  `registerBusiness` sí responde
  `{ result: null, error: "TOO_MANY_REQUESTS", status: 429, message }`, sin campos extra:
  `retryAfterSeconds` no cabe en `TrpcResponse` y la UI muestra un mensaje genérico de reintento.
- `requestPasswordReset` **sigue respondiendo éxito** aunque esté limitado: revelar el
  bloqueo volvería a convertir el endpoint en un oráculo de existencia de cuentas
  (ver `F1-09`). Simplemente no se envía correo.
- Limpieza: al reservar, borrar intentos de más de 24 h **solo para los identificadores y
  acciones consultados**. El predicado usa el índice compuesto de F0-12 y evita un barrido
  global dentro de una ruta de auth.
- Para cuentas inexistentes u OAuth-only, `authorize` ejecuta una comparación bcrypt contra
  un hash dummy cost 12 obtenido desde `password.ts`; no retorna antes de bcrypt. El hash
  dummy se inicializa una vez por proceso y nunca se loguea. Después se devuelve `null`
  igual que para password incorrecto, reduciendo enumeración temporal.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; `TOO_MANY_REQUESTS` como código estable.
- TypeScript estricto: sin `any`; `db` inyectado por parámetro.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Nunca registrar en logs la contraseña intentada ni el correo completo.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] Tras 10 intentos fallidos de login sobre el mismo correo en 15 min, el intento 11 se
      rechaza antes de bcrypt aunque la contraseña sea correcta.
- [ ] Los aciertos de login no consumen cuota.
- [ ] Solicitudes concurrentes no pueden superar `max`; no hay `check` y `record` separados.
- [ ] `requestPasswordReset` limitado responde igual que uno no limitado, pero no envía correo.
- [ ] Login limitado conserva el mismo error genérico de credenciales; registro limitado
      retorna exactamente el contrato con `TOO_MANY_REQUESTS`/429 y la UI lo traduce.
- [ ] `AuthAttempt.identifier` no contiene email ni IP en claro.
- [ ] `TOO_MANY_REQUESTS` tiene clave en `errors.json` en ambos locales.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

—
