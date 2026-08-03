# F1 — Hallazgos abiertos (requieren decisión de Roger u otra fase)

Problemas detectados durante la planificación de F1 que **no** se resuelven dentro de los
tickets `F1-01`…`F1-08` (el antiguo `F1-09`, dedicado a pruebas de guardas, se eliminó al
descartar el testing automatizado). Los problemas resueltos están documentados en la sección
*Contexto* del ticket correspondiente.

## ALTA

### A1. El helper `fail` del contrato (F0 §4) no admite códigos de error de módulo

`spec/00-foundations.md` §4 tipa `fail(error: ErrorCode, …)` contra el union cerrado
`ERROR_CODES`, pero el propio §4 dice que los códigos de dominio (`EMAIL_TAKEN`,
`SKU_TAKEN`…) viajan por el genérico `TError`. Con esa firma, `fail("EMAIL_TAKEN", 409, …)`
no compila. Afecta a F1 (EMAIL_TAKEN) y a todas las fases siguientes.

- **Recomendación**: corregir F0 §4 a
  `fail<T = never, E extends string = ErrorCode>(error: E, status: number, message: string): TrpcResponse<T, E>`.
  Mientras tanto, `F1-04` incluye la generalización (retrocompatible) como parte de su alcance.

## MEDIA

### M1. Flujo de recuperación de contraseña inexistente en todas las fases

W2 muestra "¿Olvidaste tu contraseña?" y la spec F1 §4 lo deja como *placeholder*, pero
ninguna fase (F0–F6) define el flujo real (token de reset, email, expiración). Un negocio
que olvide su contraseña queda bloqueado sin intervención manual.

- **Recomendación**: decidir fase (sugerido: F6 o una F1.5) y proveedor de email
  transaccional (Resend/SES). Hasta entonces, el link debe ser visiblemente inerte o
  apuntar a un mailto de soporte — decisión de producto de Roger.

### M2. Vinculación de cuentas OAuth vs Credentials (OAuthAccountNotLinked)

Un dueño de negocio registrado con email+contraseña que intente "Continuar con Google"
con el mismo email recibirá el error `OAuthAccountNotLinked` (comportamiento por defecto
de NextAuth: no vincula cuentas por email). La spec no lo contempla.

- **Recomendación**: decisión explícita de Roger: (a) aceptar el comportamiento y añadir
  copy traducido para ese error en `/login` (barato, seguro — sugerido), o
  (b) activar `allowDangerousEmailAccountLinking` en Google solo si se asume el riesgo de
  account takeover con emails no verificados.

### M3. Sin rate limiting ni lockout en login y registro

`authorize` compara bcrypt (coste 12) en cada intento y `registerBusiness` es público:
sin límite de intentos son vectores de fuerza bruta/enumeración y de gasto de CPU.

- **Recomendación**: fuera de alcance de F1 (no hay infraestructura definida). Decidir en
  F3+ (donde ya hay dinero de por medio): Upstash Ratelimit o middleware propio por IP.

## BAJA

### B1. No existe acción de sign-out en ninguna spec

Ni F0 (layouts/sidebar-user-card) ni F1 definen botón/acción de cerrar sesión. Los
usuarios de dashboard/admin no pueden salir salvo borrando cookies.

- **Recomendación**: añadir a F2 (dashboard) y F5 (admin) un item de sign-out en
  `sidebar-user-card` usando `signOut()` — o adelantarlo como micro-ticket si Roger lo
  quiere en F1.

### B2. Valor del login con Google en la web

Google solo produce usuarios `CUSTOMER`, que en la web únicamente ven el aviso "usa la
app móvil". El botón de Google en W2 aporta poco hasta que exista la app o se permita
vincular cuentas (M2).

- **Recomendación**: mantenerlo (la spec y el diseño lo piden y prepara la fase móvil),
  pero es candidato a esconderse detrás de un flag si genera confusión en demos.

### B3. Aviso `mobileOnly` no llega a usuarios CUSTOMER que entran por Google

En el flujo OAuth (redirect completo → `/post-login` → `/`) no hay toast cliente, a
diferencia del flujo credentials (resuelto en `F1-07`). El CUSTOMER de Google aterriza en
la landing sin explicación.

- **Recomendación**: si se quiere paridad, `/post-login` puede redirigir a `/?notice=mobile-only`
  y la landing (F6) leer el query param para el aviso. Decidir al pulir la landing en F6.

### B4. `emailVerified` nunca se establece para cuentas Credentials

El registro de negocio no verifica el email (no hay envío de correo en ninguna fase).
Además de spam potencial, interactúa con M2 (la vinculación segura de cuentas depende de
emails verificados).

- **Recomendación**: aceptar para el MVP; si se implementa M1 (emails transaccionales),
  añadir verificación de email en el mismo esfuerzo.

## Correcciones recomendadas a `spec/01-auth.md` (texto, no bloqueantes)

1. §1/§3: documentar el **split de configuración** (edge config sin adapter/providers para
   el middleware; config completa para route handlers) en lugar de "auth() edge-safe" —
   resuelto en `F1-03`/`F1-05`.
2. §1: el callback `session` debe describirse con `({ session, token })` (estrategia JWT),
   y la module augmentation debe incluir `interface User` además de `Session` y `JWT` —
   resuelto en `F1-03`.
3. §4: mover los schemas compartidos fuera de `_components/` (el servidor no debe importar
   de módulos de UI); los `*.schema.ts` de `_components/` quedan como re-exports —
   resuelto en `F1-01`.
4. §3: especificar el mecanismo de redirect por rol para OAuth (página `/post-login`),
   la validación anti open-redirect de `callbackUrl` y el manejo del prefijo de locale
   (`as-needed`) en el middleware — resuelto en `F1-05`/`F1-07`.
5. §2: anotar que `errors.json` (es/en) debe ganar la clave `EMAIL_TAKEN` — resuelto en `F1-04`.
6. F0 §1/§8 (cross-fase): la limpieza de Discord debe incluir `AUTH_DISCORD_*` en
   `src/env.js`, no solo el import del provider — resuelto en `F1-03`.
