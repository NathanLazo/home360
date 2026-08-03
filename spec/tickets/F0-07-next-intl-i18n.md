# [F0-07] Configurar next-intl (es/en) y reestructurar bajo `[locale]`

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §6, §7 (layout raíz); `spec/01-auth.md` §3 (middleware futuro)
- **Depende de**: `F0-06` (DropdownMenu para el LocaleSwitcher)
- **Tamaño estimado**: L (3–6 h)

## Contexto

Instala la infraestructura i18n completa: routing es/en con `localePrefix: "as-needed"`,
mensajes por namespace, mover el árbol de páginas bajo `src/app/[locale]/` dejando las
APIs fuera, y el `LocaleSwitcher`.

**Problemas detectados y resoluciones**:

1. **Hueco: middleware**. La spec F0 §6 no menciona `middleware.ts`, pero sin él next-intl
   no resuelve `/en` ni la detección de locale — y el criterio de aceptación de F0 exige
   que `/` y `/en` respondan. F1 §3 asume que "compone" next-intl + auth. **Resolución**:
   F0 crea `src/middleware.ts` solo con `createMiddleware(routing)`; F1 lo extiende con
   auth.
2. **Hueco: plugin de Next**. next-intl requiere `createNextIntlPlugin` en
   `next.config.js` para vincular `request.ts`. Se agrega aquí.
3. **Inconsistencia F0 §1 vs F6 §1**: F0 dice mover `page.tsx` "bajo `[locale]`" y F6 la
   ubica en `[locale]/(public)/page.tsx`. **Resolución**: crear desde ya el route group
   `(public)` para no mover archivos en F6/F1.

## Alcance

Crear:

- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`
- `src/messages/es/{common,landing,auth,dashboard,admin,errors}.json` y espejo en
  `src/messages/en/`
- `src/middleware.ts`
- `src/app/[locale]/layout.tsx` (nuevo layout raíz con `<html>`)
- `src/app/[locale]/(public)/page.tsx` (placeholder de landing)
- `src/components/locale-switcher.tsx`

Modificar/eliminar:

- `next.config.js` (plugin)
- Eliminar `src/app/layout.tsx` y `src/app/page.tsx` (su contenido migra al árbol
  `[locale]`); `src/app/api/**` queda intacto fuera del segmento.

Fuera de alcance: layouts de dashboard/admin (F0-09), copy real de pantallas (F1+).

## Detalle técnico

- `routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});
```

- `request.ts` (`getRequestConfig`): valida el locale contra `routing.locales` (inválido →
  `notFound()`), carga y **fusiona por namespace** los seis JSON del locale:
  `{ common, landing, auth, dashboard, admin, errors }` (imports dinámicos
  `import(\`~/messages/${locale}/common.json\`)` etc.).
- `navigation.ts`: `createNavigation(routing)` → exporta `Link`, `useRouter`,
  `usePathname`, `redirect` tipados (los usarán todos los módulos).
- `middleware.ts`: `export default createMiddleware(routing)` con matcher que excluye
  `api`, `_next`, `_vercel` y archivos con extensión:
  `matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]`.
- `next.config.js`: envolver la config con `createNextIntlPlugin()` (default busca
  `src/i18n/request.ts`).
- `[locale]/layout.tsx`: `<html lang={locale}>` + fuentes Geist/Geist Mono (mover del
  layout viejo), `NextIntlClientProvider`, `TRPCReactProvider`, `<Toaster />` de sonner,
  `setRequestLocale(locale)` y `generateStaticParams` con los locales. Validar `locale`
  con `hasLocale` → `notFound()`.
- `messages/*`: `errors.json` con una clave por cada código de `ERROR_CODES` (F0-04) en
  ambos locales; `common.json` con lo mínimo del ticket (`appName`, claves del
  LocaleSwitcher); los demás namespaces arrancan con `{}` o claves placeholder mínimas.
  Los archivos es/en deben tener **exactamente las mismas claves**.
- `locale-switcher.tsx` (client): DropdownMenu con "Español"/"English"; usa
  `useRouter`/`usePathname` de `~/i18n/navigation` para cambiar de locale preservando la
  ruta. Labels desde `common.json`.
- Placeholder `(public)/page.tsx`: Server Component con `getTranslations("landing")` y un
  título simple (clave `landing.placeholderTitle` en ambos locales) — demuestra el
  pipeline i18n end-to-end.
- Formatos: documentar en `common.json`/código el formato de moneda MXN (`cents / 100`,
  `useFormatter().number(value, { style: "currency", currency: "MXN" })`) — el helper de
  formateo compartido llega con los primeros consumos reales (F2), aquí solo el patrón.

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

- [ ] `pnpm dev`: `/` responde en español y `/en` en inglés; `/es` redirige a `/`.
- [ ] `LocaleSwitcher` alterna es/en conservando la ruta actual.
- [ ] `src/app/api/**` sigue funcionando fuera de `[locale]` (probar `/api/auth/session`).
- [ ] es/en tienen claves idénticas; `errors.json` cubre todos los códigos vigentes del
      contrato (sin congelar un conteo que fases posteriores amplían).
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde; cero strings visibles
      hardcodeados.

## Comandos para Roger (si aplica)

— (ninguno).
