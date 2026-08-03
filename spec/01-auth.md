# F1 — Autenticación, registro de negocio y roles

Cubre **W2 (login)** y el alta de negocio referida por W1/W10. Requiere F0 aplicado
(migración ejecutada por Roger).

## 1. NextAuth v5 — configuración

`src/server/auth/config.ts`:

- **Providers**: `Credentials` (email + contraseña) y `Google`.
- **Sesión JWT** (`session: { strategy: "jwt" }`) — requisito de Credentials. El
  `PrismaAdapter` se conserva para persistir usuarios/cuentas OAuth.
- Credentials `authorize`: valida input con Zod (`loginSchema`), busca usuario por email
  con `select: { id, email, name, image, role, passwordHash }`, compara con
  `bcrypt.compare`. Falla → `null` (NextAuth responde 401 genérico; nunca se distingue
  "email no existe" de "contraseña incorrecta").
- Callbacks:
  - `jwt`: en el primer sign-in copia `id` y `role` al token; en logins Google de un email
    nuevo asigna `role: CUSTOMER` por defecto (los negocios se crean solo vía `/register`).
  - `session`: expone `session.user.id` y `session.user.role`.
- Module augmentation: `Session["user"]` y `JWT` ganan `role: UserRole` (import del enum
  desde `generated/prisma`).
- Hash con `bcryptjs`, cost 12, en `src/server/services/auth/password.ts`
  (`hashPassword`, `verifyPassword`) — único lugar que toca bcrypt.

## 2. Registro de negocio

### Router `auth` (`src/server/api/routers/auth.ts`) — `publicProcedure`

| Procedure | Input (Zod) | Result | Errores |
|-----------|-------------|--------|---------|
| `registerBusiness` (mutation) | `{ ownerName, email, password (min 8), businessName, businessType: enum, guaranteeType: enum, guaranteeNotes? }` | `{ userId }` | `EMAIL_TAKEN` (409) |

Servicio `src/server/services/auth/register-business.ts`:

1. Normaliza email (trim + lowercase).
2. Transacción Prisma: crea `User { role: BUSINESS, passwordHash }` +
   `Business { status: PENDING, guaranteeType }`.
3. `P2002` → `fail("EMAIL_TAKEN", 409, …)`.
4. No inicia sesión automáticamente: el registro redirige a `/login` con toast
   "cuenta creada, pendiente de aprobación".

La suscripción se crea al aprobar el negocio (F5) — un negocio PENDING no tiene plan.

## 3. Redirect por rol y protección de rutas

- **Post-login** (W2: "según el rol redirige a /dashboard o /admin"): el formulario de
  login llama `signIn("credentials", { redirect: false })`, luego consulta la sesión y
  navega según `role`: `ADMIN → /admin`, `BUSINESS → /dashboard`,
  `CUSTOMER/WORKER → /` con aviso "usa la app móvil" (namespace `auth.mobileOnly`).
- **`middleware.ts`** (raíz de `src/`): compone next-intl + auth:
  1. `createMiddleware(routing)` de next-intl resuelve el locale.
  2. Con `auth()` (NextAuth edge-safe): sin sesión en `/dashboard/*` o `/admin/*` →
     redirect a `/login?callbackUrl=…`; con sesión pero rol incorrecto → redirect a la
     home del rol correcto. El matcher excluye `api`, `_next`, archivos estáticos.
- La protección del middleware es **cortesía de UX**; la seguridad real vive en las
  procedures por rol (F0 §5) y en los layouts de servidor (`dashboard/layout.tsx` y
  `admin/layout.tsx` verifican sesión+rol con `auth()` y hacen `redirect()`).

## 4. UI

### `/login` — `[locale]/(public)/login/`

```text
login/
├─ page.tsx                      # Server Component: card centrada, branding H
└─ _components/
   ├─ login-form.tsx             # "use client": react state + signIn credentials
   ├─ google-sign-in-button.tsx  # botón OAuth con separador "O"
   └─ login.schema.ts            # loginSchema Zod (compartido con authorize)
```

Diseño W2: card blanca centrada sobre fondo `#f4f4f5`, logo "H", título "Bienvenido de
vuelta", inputs email/contraseña, link "¿Olvidaste tu contraseña?" (placeholder), botón
primario negro, separador "O", botón Google, footer "¿Aún no tienes cuenta? → Registra tu
negocio". Errores como texto bajo el input + toast. Todo el copy desde `auth.json`.

### `/register` — `[locale]/(public)/register/`

```text
register/
├─ page.tsx
└─ _components/
   ├─ register-form.tsx          # orquesta pasos + mutation
   ├─ register-step-account.tsx  # nombre, email, contraseña
   ├─ register-step-business.tsx # nombre negocio, tipo (SERVICES/PRODUCTS/MIXED)
   ├─ register-step-guarantee.tsx# tipo de garantía (Select) + notas
   └─ register.schema.ts         # registerBusinessSchema (por paso + completo)
```

Formulario en 3 pasos con indicador de progreso; validación Zod por paso con
`safeParse` antes de avanzar; submit final → `auth.registerBusiness` → toast + redirect
`/login`.

## 5. Pruebas (Vitest)

- `register-business.test.ts`: éxito crea User+Business PENDING; email duplicado →
  `EMAIL_TAKEN`; password se hashea (no igual al plano).
- `password.test.ts`: hash/verify roundtrip.
- Guardas de procedures: caller con sesión de cada rol contra un router de prueba —
  `businessProcedure` rechaza CUSTOMER/ADMIN; `activeBusinessProcedure` rechaza PENDING.

## 6. Verificación

1. `pnpm typecheck` + `pnpm check` + `pnpm vitest run`.
2. Manual con seed: login `admin@home360.mx` → `/admin`; login dueño de "Plomería
   García" → `/dashboard`; visitar `/dashboard` sin sesión → `/login`; registro nuevo →
   negocio PENDING visible en BD (Roger lo verifica); login Google crea CUSTOMER.

### Criterios de aceptación

- [ ] Credentials + Google funcionan; `role` presente en sesión tipada.
- [ ] Redirect por rol exacto al del diseño W2.
- [ ] `/dashboard/*` y `/admin/*` inaccesibles sin el rol correcto (middleware + layout + procedure).
- [ ] Registro crea negocio PENDING sin sesión automática.
- [ ] Copy completo en es/en; cero strings hardcodeados.
