# HOME360 — Guía del proyecto para agentes

Marketplace de productos y servicios de mantenimiento del hogar en México, con pago
protegido en **escrow**: el dinero del cliente queda retenido hasta que el trabajo se
entrega con evidencia grabada. Lanzamiento en Chihuahua. Este repo es **la plataforma
web** (landing + dashboard de negocio + admin + corporate); la app móvil es un proyecto
aparte (`spec/10-mobile-app.md`, tickets M0–M7 en `home360-app/spec`).

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Server Components por defecto, Turbopack en dev) |
| API | tRPC 11 con contrato `TrpcResponse` obligatorio |
| ORM | Prisma 6 + PostgreSQL (cliente generado en `generated/prisma`) |
| Auth | NextAuth v5 (Credentials + Google, sesión JWT, roles) |
| Pagos | Stripe: Connect (retiros), Billing (suscripciones), PaymentIntents + Transfers (escrow) |
| UI | Tailwind 4 + shadcn/ui (Radix) + visx (charts) + lucide-react + Magic UI (solo landing) |
| i18n | next-intl — `es` (default) / `en`, ambos al 100 % |
| Validación | Zod en todo límite de entrada |
| Paquetes | pnpm |

## Estructura del repositorio

```
home360/
├─ PRODUCT.md              # Contexto estratégico (registro, usuarios, principios) — leer antes de diseñar
├─ DESIGN.md               # Sistema visual (tokens, tipografía, reglas) — leer antes de tocar UI
├─ PENDIENTES.md           # Decisiones cerradas del flujo de dinero (normativo para pagos)
├─ spec/                   # Especificaciones ejecutables de la plataforma web
│  ├─ README.md            #   Índice, pantallas W1–W13, stack y convenciones roger-arq
│  ├─ 00–06-*.md           #   Fases F0–F6: foundations, auth, dashboard, pagos, subs, admin, landing
│  ├─ 07-product-context.md#   Contexto de app móvil y modelo de negocio
│  ├─ 08-business-model-alignment.md # Decisiones D1–D8 (comisión, marca/zinc D7, métricas)
│  ├─ 09-corporate-accounts.md       # F7: cuentas corporativas consumidoras
│  ├─ 10-mobile-app.md     #   Plan de la app móvil (Expo, fuera de este repo)
│  ├─ DESIGN-DIRECTIVE.md  #   Normativo visual de ejecución (tipografía, color, motion, checklist)
│  └─ tickets/             #   La unidad real de trabajo: F0-01 … F7-xx + findings por fase
├─ design/                 # Diseños fuente (HOME360-Web.dc.html, app móvil)
├─ prisma/                 # schema.prisma, seed.ts y escenarios de seed
├─ generated/              # Cliente Prisma generado (no editar a mano)
├─ scripts/                # Sincronización de planes/tiers de Stripe
├─ public/                 # Estáticos
└─ src/
   ├─ middleware.ts        # Locale (next-intl) + guards de auth
   ├─ env.js               # Variables de entorno tipadas (@t3-oss/env-nextjs)
   ├─ app/
   │  ├─ api/              # Route handlers: auth, trpc, webhooks (Stripe), cron, mobile (API Bearer JWT)
   │  └─ [locale]/         # Todo lo visible vive bajo locale
   │     ├─ (public)/      # W1 landing — ÚNICO lugar donde existen los tokens --brand-*
   │     ├─ dashboard/     # W3–W8: negocio (KPIs, catálogos, cobros, suscripción, sucursales)
   │     ├─ admin/         # W9–W13: plataforma (cuentas, disputas, finanzas, settings)
   │     ├─ corporate/     # F7: portal de cuentas corporativas
   │     └─ pay/           # Links de cobro para clientes finales
   ├─ components/          # Compartidos: ui/ (shadcn), charts/ (visx), dashboard/, tablas, estados
   ├─ hooks/               # Hooks compartidos
   ├─ i18n/                # Configuración next-intl (routing, request)
   ├─ messages/            # es/ y en/ — todo el copy visible sale de aquí
   ├─ lib/                 # Utilidades cliente/isomórficas: trpc-envelope, trpc-errors, nav, utils
   ├─ schemas/             # Schemas Zod compartidos
   ├─ server/
   │  ├─ auth/             # Configuración NextAuth v5
   │  ├─ db.ts             # Cliente Prisma
   │  ├─ services/         # Lógica de dominio (la capa que las procedures invocan)
   │  └─ api/              # tRPC: root.ts, trpc.ts (procedures por rol), contract.ts,
   │                       #   routers/ (auth, dashboard, order, payment, subscription,
   │                       #   marketplace, team, branch, corporate, admin/, …)
   ├─ styles/globals.css   # Tokens: zinc shadcn (oklch) + --brand-* + charts + reduced-motion
   └─ trpc/                # Cliente tRPC para React
```

## Convenciones no negociables (contrato roger-arq)

1. **Código 100 % en inglés** (rutas, archivos, variables, modelos, enums). El copy
   visible sale de `src/messages/` — cero strings hardcodeados, es y en completos.
2. **Módulos localizados**: cada página mantiene sus piezas en una carpeta privada
   `_components` propia. `page.tsx` es composición delgada. Nada se importa desde el
   `_components` de otro módulo.
3. **Componentización máxima**: un archivo = una responsabilidad (vista, tabla, fila,
   formulario, badge, filtros y hook de mutations separados).
4. **Capas estrictas**: UI → cliente tRPC → router/procedure → servicio de dominio →
   Prisma. Los componentes jamás tocan Prisma; las procedures no llevan lógica de negocio
   extensa (vive en `src/server/services/`).
5. **Contrato tRPC uniforme**: toda procedure retorna `{ result, error, status, message }`
   (`TrpcResponse<T>`). Fallo → `result: null` y código estable (`USER_NOT_FOUND`,
   `PLAN_LIMIT_REACHED`…) que la UI traduce por locale.
6. **TypeScript estricto**: prohibidos `any`, casts amplios y `@ts-ignore`. `unknown` +
   narrowing para datos externos; tipos inferidos desde Zod/Prisma/tRPC.
7. **Procedures por rol**: `business`, `admin`, `corporate` — el acceso se decide en la
   capa tRPC, no en la UI.

## Frontera de diseño D7 (inviolable)

- `src/app/[locale]/(public)/**` → paleta de marca `--brand-*` (navy/gold/cream/gray),
  Fraunces como display, personalidad **Premium**.
- `dashboard/**`, `admin/**`, `corporate/**`, auth → zinc shadcn, personalidad
  **Corporate**, sin animaciones de entrada por scroll.
- Los tokens `--brand-*` **no aparecen** fuera de `(public)/`; los tokens zinc no se
  reescriben para la landing. Detalle completo en `spec/DESIGN-DIRECTIVE.md` y `DESIGN.md`.

## Flujo de trabajo

- **La unidad de trabajo son los tickets** de `spec/tickets/` (F0–F7). Cada ticket corrige
  y precisa la spec que lo origina; los `F*-findings.md` registran lo aprendido por fase.
- **No hay pruebas automatizadas.** La verificación es:

```bash
pnpm typecheck
```

```bash
pnpm check
```

```bash
pnpm build
```

- Base de datos: `pnpm db:generate` (migrate dev), `pnpm db:migrate` (deploy),
  `pnpm db:seed`, `pnpm db:studio`. Local: `./start-database.sh`.
- Dev server: `pnpm dev` (Turbopack).
- Formato: `pnpm format:write` (Prettier con plugin Tailwind).
- Decisiones de dinero (reembolsos, saldo disponible, retiros, tarifa): `PENDIENTES.md`
  es normativo; no reabrir decisiones D1–D8 de `spec/08-business-model-alignment.md`.

## Checklist de entrega de UI (resumen de DESIGN-DIRECTIVE §8)

- Cero strings hardcodeados; es y en completos.
- Jerarquía de headings sin saltos; un solo `h1` por página.
- Foco visible, navegación completa por teclado, contraste AA verificado.
- `prefers-reduced-motion` respetado sin pérdida de contenido ni layout.
- Loading (skeleton con forma real), empty (CTA), error (reintento) y éxito implementados.
- Frontera D7 intacta; `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
