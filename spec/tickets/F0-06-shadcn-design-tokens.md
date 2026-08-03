# [F0-06] Inicializar shadcn/ui (Tailwind 4) y tokens de diseño

## Metadatos

- **Fase**: F0 — Fundaciones
- **Spec origen**: `spec/00-foundations.md` §2 (shadcn), §7 (tokens/fuentes)
- **Depende de**: `F0-02`
- **Tamaño estimado**: M (1–3 h)

## Contexto

Instala shadcn/ui sobre Tailwind 4 (sin `tailwind.config`; tokens vía CSS en
`globals.css`) y deja los tokens zinc del diseño y las fuentes Geist listos.

**Riesgos de versión detectados y resoluciones**:

1. **Tailwind 4 + shadcn**: el CLI actual de shadcn soporta Tailwind v4 (config CSS-first,
   variables en `@theme inline`); el concepto de "estilo new-york" quedó como default y
   los "styles" están deprecados en el CLI nuevo. **Resolución**: aceptar los defaults del
   init (equivalen a new-york), base color `zinc`, CSS variables. Si el CLI pregunta por
   `tailwind.config`, no crear ninguno.
2. **Ruta de CSS no estándar**: el proyecto usa `src/styles/globals.css` (no
   `app/globals.css`). **Resolución**: verificar/ajustar `components.json` para que
   `tailwind.css` apunte a `src/styles/globals.css` y los aliases usen `~/components` y
   `~/lib/utils`.
3. **`sonner` de shadcn importa `next-themes`** (`useTheme`) y el proyecto no usa theme
   switching (el sidebar oscuro del admin es estilo fijo, no dark mode). **Resolución**:
   tras `add sonner`, editar `src/components/ui/sonner.tsx` para eliminar la dependencia
   de `next-themes` (theme fijo `"light"`); **no** instalar `next-themes`.

## Alcance

Crear/modificar:

- `components.json` (generado por init, ajustado)
- `src/styles/globals.css` (tokens)
- `src/lib/utils.ts` (`cn`, generado por init)
- `src/components/ui/*` (componentes instalados)
- `src/app/layout.tsx` (solo fuentes: agregar Geist Mono; el resto del layout se
  reestructura en F0-07)
- `package.json` y `pnpm-lock.yaml` — únicamente los cambios de dependencias que haga el
  CLI de shadcn; no agregar `next-themes`.

Fuera de alcance: componentes compartidos propios (F0-08), layouts dashboard/admin
(F0-09), Magic UI (F6).

## Detalle técnico

Comandos (no tocan BD; permitidos):

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label select dropdown-menu dialog alert-dialog sheet table badge tabs skeleton sonner separator avatar switch textarea command chart
```

`globals.css` — mantener `@import "tailwindcss"` y el bloque `@theme` de fuentes; el init
agrega los tokens shadcn. Ajustarlos al diseño:

- `--background: #f4f4f5` (zinc-100), `--foreground: #09090b` (zinc-950),
  `--muted-foreground: #71717a` (zinc-500) — respetando el formato de color que genere el
  CLI (si emite oklch, usar los equivalentes oklch de esos zinc).
- `--radius: 0.5rem` (8 px).
- Fuente mono: registrar `--font-geist-mono` en el `@theme` y exponer utilidad
  (`font-mono`) para folios/SKU/montos.

### Tokens de marca (D7)

El brandbook oficial (deck, slide 18) no es la paleta de la app: la app es zinc. Para no
mezclarlas, los colores de marca se declaran como **capa aparte** en el mismo `globals.css`,
fuera del bloque de tokens shadcn:

```css
:root {
  --brand-navy: #0d1b2a;
  --brand-gold: #c8a96e;
  --brand-cream: #f5f0e8;
  --brand-gray: #8a9bb0;
}
```

Frontera, y es no negociable (`spec/08-business-model-alignment.md` D7):

- **Solo la landing** (`(public)/`) consume `--brand-*`.
- **Dashboard y admin** (`/dashboard`, `/admin`) usan exclusivamente los tokens zinc de
  shadcn: son herramientas de trabajo y el diseño W2–W13 las define así.
- Un token de marca usado fuera de la landing es un bug de revisión, no una decisión de
  estilo.

`src/app/layout.tsx` — agregar `Geist_Mono` de `next/font/google` con
`variable: "--font-geist-mono"` junto al `Geist` existente; ambas variables en `<html>`.

Verificar que `chart` compila contra la versión de recharts instalada (F0-02) y que
`<Toaster />` (sonner) renderiza sin `next-themes` — su montaje en el layout llega en
F0-07/F0-09.

Nota: los componentes `ui/` generados son la excepción permitida a "un archivo = una
responsabilidad" (código vendored del registry; no se refactorizan).

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

- [ ] Los 20 componentes listados existen en `src/components/ui/`.
- [ ] `components.json` apunta a `src/styles/globals.css` y a los aliases `~/…`.
- [ ] Los cuatro tokens `--brand-*` declarados como capa separada, con el comentario que
      documenta que solo la landing puede consumirlos.
- [ ] Tokens `background/foreground/muted/radius` alineados al diseño; sin `tailwind.config.*`.
- [ ] `sonner.tsx` sin import de `next-themes`; `next-themes` NO está en `package.json`.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.

## Comandos para Roger (si aplica)

— (ninguno).
