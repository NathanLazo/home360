# HOME360 Web — Especificaciones de arquitectura

Especificaciones ejecutables de la plataforma web de HOME360, derivadas del diseño
`HOME360 Web.dc.html` (proyecto Claude Design `8c4ad1a4-a9b7-418f-9613-41eb6a72fec1`).
Cada spec es autocontenida: un agente puede ejecutarla sin acceso a la conversación original.

> **Dos avisos que anulan partes de estas specs.**
> 1. **No hay pruebas automatizadas.** Las secciones "Pruebas" de `00`–`06` quedan sin efecto:
>    no se instala vitest ni se escriben `*.test.ts`. La verificación es `pnpm typecheck`,
>    `pnpm check` y `pnpm build`.
> 2. La unidad de trabajo real son los **tickets** de `spec/tickets/` (ver su
>    [README](tickets/README.md)); cada uno corrige y precisa la spec que lo origina.
>    El contexto de la app móvil y del modelo de negocio vive en
>    [`07-product-context.md`](07-product-context.md).

## Producto

HOME360 es un marketplace de productos y servicios para el hogar:

- Los **clientes** diagnostican su problema con una foto desde la **app móvil** (IA sugiere
  categoría, precio justo y solución) y pagan con protección **escrow**.
- Los **negocios** (servicios, ferreterías o mixtos) gestionan desde la **web** su catálogo,
  sucursales, cobros y suscripción.
- El **equipo interno** opera la plataforma desde `/admin`: aprobación de cuentas, disputas,
  finanzas y variables de la IA.

Esta especificación cubre **solo la plataforma web**: las 13 pantallas base W1–W13 y el
módulo corporativo añadido en F7. La app móvil consume el mismo `appRouter` de tRPC en el
futuro.

## Pantallas del diseño

| ID | Ruta | Pantalla |
|----|------|----------|
| W1 | `/` | Landing pública (CTA: registro de negocio) |
| W2 | `/login` | Login único con redirect por rol |
| W3 | `/dashboard` | Inicio del negocio: KPIs, gráfica, órdenes recientes |
| W4 | `/dashboard/services` | Catálogo de servicios |
| W5 | `/dashboard/products` | Catálogo de productos (+import CSV) |
| W6 | `/dashboard/payments` | Cobros: escrow, links de cobro, retiros |
| W7 | `/dashboard/subscription` | Planes y facturación |
| W8 | `/dashboard/branches` | Sucursales |
| W9 | `/admin` | Resumen de plataforma |
| W10 | `/admin/users` | Gestión de cuentas (negocios/clientes/trabajadores) |
| W11 | `/admin/disputes` | Disputas master-detail con resolución de escrow |
| W12 | `/admin/finance` | Finanzas: comisiones, suscripciones, retiros |
| W13 | `/admin/settings` | Variables IA, comisiones, tarifas, notificaciones |

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Server Components por defecto) |
| API | tRPC 11 con contrato `TrpcResponse` obligatorio |
| ORM | Prisma 6 + PostgreSQL (cliente generado en `generated/prisma`) |
| Auth | NextAuth v5 (Credentials + Google, sesión JWT, roles) |
| Pagos | Stripe: Connect (retiros), Billing (suscripciones), PaymentIntents + Transfers (escrow) |
| UI | Tailwind 4 + shadcn/ui (Radix) + Recharts + lucide-react + Magic UI (solo landing) |
| i18n | next-intl, locales `es` (default) / `en` |
| Validación | Zod en todo límite de entrada |
| Paquetes | pnpm |

## Convenciones no negociables (contrato roger-arq)

1. **Código 100 % en inglés**: rutas, carpetas, archivos, variables, modelos, enums.
   El copy visible al usuario sale de traducciones (nunca hardcodeado).
2. **Módulos localizados**: cada página mantiene sus piezas en una carpeta privada
   `_components` (componentes, hooks, `*.schema.ts`, `*.types.ts`, utils). `page.tsx` es
   composición delgada. Nada se importa desde el `_components` de otro módulo.
3. **Componentización máxima**: un archivo = una responsabilidad. Vista orquestadora,
   tabla, fila de acciones, formulario, badge, filtros y hook de mutations son archivos
   separados.
4. **Capas**: UI → cliente tRPC → router/procedure → servicio de dominio → Prisma.
   Los componentes jamás tocan Prisma; las procedures no contienen lógica de negocio extensa.
5. **Contrato tRPC uniforme**: toda procedure retorna
   `{ result, error, status, message }` (`TrpcResponse<T>`). Éxito → `error: null`;
   fallo → `result: null` y `error` con un **código estable** (`USER_NOT_FOUND`,
   `PLAN_LIMIT_REACHED`…) que la UI traduce por locale.
6. **TypeScript estricto**: prohibidos `any`, casts amplios, `@ts-ignore`. `unknown` +
   narrowing para datos externos. Tipos inferidos desde Zod/Prisma/tRPC.
7. **Prisma**: `select` explícito y mínimo, tipos generados (`Prisma.ModelGetPayload`),
   `@@index` en FKs y filtros, transacciones para operaciones atómicas.
8. **Seguridad de BD**: el agente solo ejecuta `pnpm prisma generate`. Migraciones, seed
   y cualquier comando de datos los ejecuta **Roger** (ver "Comandos de Roger" en cada spec).
9. **Multitenancy en la consulta**: el negocio se resuelve desde la sesión
   (`ctx.business.id`), nunca desde el input; el filtro de tenant va dentro del query.
10. **Dinero en centavos** (`Int`, MXN) en toda la BD y servicios; el formateo a moneda
    ocurre solo en la UI vía next-intl.

## Jerarquía de procedures

```text
publicProcedure                      # landing, registro, login
└─ protectedProcedure                # sesión válida (base, no se usa directo)
   ├─ userProcedure                  # CUSTOMER → ctx.customer
   ├─ businessProcedure              # BUSINESS → ctx.business (id, plan, status)
   │  └─ activeBusinessProcedure     # + business.status === ACTIVE
   ├─ corporateProcedure             # CORPORATE → ctx.corporateAccount
   │  └─ activeCorporateProcedure    # + corporateAccount.status === ACTIVE
   └─ adminProcedure                 # ADMIN → routers admin.*
```

Rol incorrecto → `{ result: null, error: "FORBIDDEN", status: 403, message }` sin revelar si el
recurso existe.

## Mapa de fases

| Spec | Fase | Depende de |
|------|------|-----------|
| [00-foundations.md](00-foundations.md) | Limpieza, schema Prisma completo, contrato, procedures por rol, shadcn/ui, next-intl, layouts, seed | — |
| [01-auth.md](01-auth.md) | Credentials + Google, registro de negocio, roles, middleware | F0 + migración |
| [02-business-dashboard.md](02-business-dashboard.md) | W3 KPIs, W4 servicios, W5 productos, W8 sucursales, órdenes | F1 |
| [03-payments.md](03-payments.md) | Stripe Connect, escrow, links de cobro, retiros, webhooks (W6) | F2 |
| [04-subscriptions.md](04-subscriptions.md) | Stripe Billing, límites de plan, facturas (W7) | F3 |
| [05-admin.md](05-admin.md) | W9–W13: aprobaciones, disputas, finanzas, settings | F3 + F4 |
| [06-landing-polish.md](06-landing-polish.md) | W1 landing con marca, team/settings, pulido final | F2 |
| [09-corporate-accounts.md](09-corporate-accounts.md) | **F7** — cuentas corporativas B2B del deck (membresías, sucursales, facturación consolidada) | F4 + F5 + XC-25/XC-26 |

Documentos transversales, no son fases:

| Documento | Para qué |
|-----------|----------|
| [07-product-context.md](07-product-context.md) | App móvil y deck de socios como contexto: qué existe fuera de la web y qué huecos revela |
| [08-business-model-alignment.md](08-business-model-alignment.md) | **Normativo**: decisiones D1–D8 que alinean el plan con el deck. Manda sobre las specs 00–06 |

Cada fase termina verificable: `pnpm typecheck`, `pnpm check` y `pnpm build` limpios, y app
navegable.

## Comandos que ejecuta Roger (nunca el agente)

```bash
pnpm prisma migrate dev --name <nombre>
```

```bash
pnpm db:seed
```

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Variables `.env` requeridas (F0 documenta cada una): `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
