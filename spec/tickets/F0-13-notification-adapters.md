# [F0-13] Declarar adaptadores inyectables de correo y SMS

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/08-business-model-alignment.md` D9
- **Depende de**: `F0-02`, `F0-10`
- **Tamaño estimado**: S (< 1 h)

## Contexto

D9 fija Resend para correo y send.dm para SMS, ambos detrás de adaptadores inyectables. Los
tickets F0 existentes solo declaraban variables de entorno y diferían los adaptadores, por
lo que el requisito normativo quedaba sin unidad de trabajo. Este ticket crea los contratos
y el adaptador de Resend; para send.dm declara el borde tipado e inyectable, ya que todavía
no existe un flujo web ni un contrato HTTP/SDK versionado que permita fijar transporte sin
inventar una integración.

## Alcance

Crear:

- `src/server/services/email/email-client.ts`
- `src/server/services/sms/sms-client.ts`

Modificar:

- `package.json` — agregar `resend` como dependencia de producción.
- `pnpm-lock.yaml` — actualizar exclusivamente mediante `pnpm`.
- `src/env.js` y `.env.example` — `RESEND_API_KEY`, `EMAIL_FROM`, `SENDDM_API_KEY` y
  `SMS_FROM`; las dos variables SMS son opcionales mientras no exista consumidor.

Fuera de alcance: enviar notificaciones desde routers o componentes, templates/copy de
recuperación e invitaciones, reintentos/colas, webhooks y una llamada HTTP real a send.dm.
El primer flujo SMS debe aportar el contrato oficial vigente y una implementación de
`SendDmTransport` sin cambiar la interfaz de dominio definida aquí.

## Detalle técnico

Instalar sin fijar una versión inventada:

```bash
pnpm add resend
```

`email-client.ts`:

- Incluir `import "server-only"`.
- Exportar `EmailMessage` con `to: string | readonly string[]`, `subject: string`,
  `text?: string` y `html?: string`.
- Exportar `EmailSendResult = { providerMessageId: string }`.
- Exportar `EmailClient` con
  `send(message: EmailMessage): Promise<EmailSendResult>`.
- Exportar `createResendEmailClient(resend: Resend, from: string): EmailClient`. El método
  adapta `resend.emails.send`, valida el resultado sin casts amplios y nunca importa `env`
  directamente: la instancia y `EMAIL_FROM` se inyectan en el borde que componga el flujo.
- Si Resend devuelve error o no devuelve id, lanzar un error interno corto sin incluir
  payloads, destinatarios ni secretos. El servicio de dominio consumidor lo normaliza al
  código estable que corresponda antes de retornar `TrpcResponse`.

`sms-client.ts`:

- Incluir `import "server-only"`.
- Exportar `SmsMessage = { to: string; body: string }`,
  `SmsSendResult = { providerMessageId: string }` y `SmsClient` con
  `send(message: SmsMessage): Promise<SmsSendResult>`.
- Exportar el borde de proveedor:

```ts
export type SendDmTransport = {
  send(input: {
    from: string;
    to: string;
    message: string;
  }): Promise<{ id: string }>;
};
```

- Exportar `createSendDmSmsClient(transport: SendDmTransport, from: string): SmsClient`.
  El adaptador solo transforma `body` a `message` y devuelve `providerMessageId`.
- No importar `env`, usar `fetch` ni asumir URL, autenticación o forma de respuesta de
  send.dm: D9 define el proveedor, pero la documentación auditada no define ese contrato.

Regla transversal: componentes y routers nunca reciben SDKs ni llaman estos adaptadores
directamente. Un servicio de dominio recibe `EmailClient`/`SmsClient` por parámetro. No hay
procedures en este ticket; cuando existan, retornan siempre
`{ result, error, status, message }`.

## Restricciones no negociables

- Contrato `TrpcResponse<TResult, TError>` en toda procedure; errores como códigos estables.
- Jerarquía de procedures por rol; tenant desde sesión, filtrado en la query Prisma.
- TypeScript estricto: sin `any`, sin `@ts-ignore`; datos externos como `unknown` con narrowing.
- Identificadores, rutas y carpetas en inglés; copy visible solo vía next-intl (es/en).
- Dinero en centavos (Int); formateo solo en UI.
- Componentización máxima: un archivo = una responsabilidad.
- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuración de test;
  la verificación es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- BD: el agente solo puede ejecutar `pnpm prisma generate`. Migraciones/seed/SQL las corre Roger.

## Criterios de aceptación

- [ ] `EmailClient` y `SmsClient` son contratos pequeños, exportados y sin dependencia de env.
- [ ] Resend queda detrás de `createResendEmailClient`; ningún componente/router importa
      `resend`.
- [ ] send.dm queda detrás de `SendDmTransport` y `createSendDmSmsClient`, sin inventar un
      endpoint o payload externo no documentado.
- [ ] No existe `any`, cast amplio, secreto, destinatario ni payload sensible en errores.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno; Roger completa las variables reales fuera del repo).
