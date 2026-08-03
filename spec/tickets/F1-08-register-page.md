# [F1-08] Construir página `/register` (wizard 3 pasos de alta de negocio)

## Metadatos

- **Fase**: F1 — Autenticación, registro de negocio y roles
- **Spec origen**: `spec/01-auth.md` §2 (flujo), §4 (`/register`) · `spec/00-foundations.md` §6 (i18n), §7 (design system)
- **Depende de**: `F1-01` (schemas por paso), `F1-04` (mutation `auth.registerBusiness`),
  `F1-07` (serializa ownership de `auth.json`)
- **Tamaño estimado**: M

## Contexto

Alta de negocio en 3 pasos (cuenta → negocio → garantía) con validación Zod por paso,
submit final a `auth.registerBusiness`, y redirect a `/login` con toast "cuenta creada,
pendiente de aprobación" (sin sesión automática).

**Resoluciones a huecos de la spec**:

1. El toast debe sobrevivir al `router.push("/login")`: sonner persiste en navegación
   cliente (Toaster en layout raíz de F0), así que basta disparar el toast antes del push.
2. Los labels de los enums `BusinessType` y `GuaranteeType` son copy visible: van a
   `auth.json` con clave por valor del enum (nunca el literal del enum en pantalla).
3. `EMAIL_TAKEN` llega dentro del contrato (`{ error: "EMAIL_TAKEN", status: 409 }`, no
   como excepción de tRPC): la UI lo detecta en `data.error`, muestra el mensaje traducido
   de `errors.json` bajo el campo email y regresa al paso 1.
4. F1-11 añadirá `TOO_MANY_REQUESTS`; el formulario debe tratar cualquier código permitido
   del contrato mediante un mapa exhaustivo y nunca mostrar `message` del servidor como copy.

## Alcance

Crear:

- `src/app/[locale]/(public)/register/page.tsx`
- `src/app/[locale]/(public)/register/_components/register-form.tsx`
- `src/app/[locale]/(public)/register/_components/register-step-account.tsx`
- `src/app/[locale]/(public)/register/_components/register-step-business.tsx`
- `src/app/[locale]/(public)/register/_components/register-step-guarantee.tsx`
- `src/app/[locale]/(public)/register/_components/register-progress.tsx`
- `src/app/[locale]/(public)/register/_components/register.schema.ts` (re-export de `~/schemas/auth/register-business.schema`)

Modificar:

- `src/messages/es/auth.json` y `src/messages/en/auth.json` (namespace `register`)

Fuera de alcance: aprobación del negocio (F5), login (F1-07), emails transaccionales.

## Detalle técnico

### `register-form.tsx` (`"use client"`, orquestador)

- Estado: `step: 0 | 1 | 2` y tres estados completos tipados desde
  `z.infer<typeof registerAccountStepSchema>`,
  `z.infer<typeof registerBusinessStepSchema>` y
  `z.infer<typeof registerGuaranteeStepSchema>`. En submit se combinan y se validan con
  `registerBusinessSchema.safeParse`; no usar `Partial`, assertions ni casts.
- "Continuar" valida el paso actual con el schema del paso (`safeParse`); errores por
  campo bajo cada input. "Atrás" conserva valores. Al fallar, enfoca el primer campo inválido
  y cada mensaje queda unido con `aria-describedby`.
- Submit final: `registerBusinessSchema.safeParse` del acumulado y
  `api.auth.registerBusiness.useMutation()`:
  - `data.error === "EMAIL_TAKEN"` → volver al paso 0, error bajo email con
    `errors.EMAIL_TAKEN` + toast.
  - Otro `data.error` → toast con la traducción del código (`errors.json`).
  - `data.result` → `toast.success(t("register.success"))` y `router.push("/login")`
    (router de `~/i18n/navigation`).
- Cada paso es un componente presentacional (valores + errores + onChange por props);
  el hook de mutación y la máquina de pasos viven solo en `register-form.tsx`.
- El wizard es un `<form>` real: Enter avanza o envía según el paso; botones Atrás/Continuar
  declaran `type`; no hay submit accidental. Email usa `autoComplete="email"` y password
  `autoComplete="new-password"`.

### Pasos

- `register-step-account.tsx`: `ownerName`, `email`, `password` (inputs shadcn + Label).
- `register-step-business.tsx`: `businessName`, `businessType` (Select shadcn con
  opciones `SERVICES | PRODUCTS | MIXED` y labels de `auth.register.businessType.*`).
- `register-step-guarantee.tsx`: `guaranteeType` (Select con los 5 valores de
  `GuaranteeType`, labels `auth.register.guaranteeType.*`) + `guaranteeNotes` (Textarea
  opcional).
- `register-progress.tsx`: indicador de progreso (3 puntos/segmentos, paso activo con
  token `primary`); labels de paso desde i18n.

### `page.tsx`

Server Component: misma carcasa visual que login (fondo `bg-muted`, Card centrada, logo
"H"), título/subtítulo de `auth.register`, `<RegisterForm />`, footer link a `/login`.

### i18n — `auth.json` namespace `register` (es/en)

`title`, `subtitle`, `steps.account`, `steps.business`, `steps.guarantee`, labels y
placeholders por campo, `businessType.SERVICES|PRODUCTS|MIXED`,
`guaranteeType.DEPOSIT|VERIFICATION|INSURANCE_PER_SERVICE|REGISTERED_ASSET|COMBINED`,
`back`, `next`, `submit`, `success` ("Cuenta creada, pendiente de aprobación" / en),
`haveAccount`, `loginCta`. Cero strings hardcodeados.

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

- [ ] No se puede avanzar de paso con datos inválidos; los errores aparecen bajo el campo correspondiente.
- [ ] Registro exitoso → toast de éxito → `/login`, sin sesión iniciada.
- [ ] Email ya usado → regresa al paso 1 con error `EMAIL_TAKEN` traducido bajo el email.
- [ ] Errores desconocidos usan `errors.UNKNOWN_ERROR`; nunca se pinta `data.message`.
- [ ] Roger verifica en BD: `User(role=BUSINESS)` + `Business(status=PENDING)` sin `Subscription`.
- [ ] Copy completo es/en incluidos los labels de enums; `pnpm typecheck`, `pnpm check` y
      `pnpm build` en verde.

## Comandos para Roger (si aplica)

- Verificación en BD del negocio PENDING tras un registro de prueba (spec §6).
