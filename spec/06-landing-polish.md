# F6 — Landing con Magic UI, módulos restantes y pulido final

Cubre **W1 (landing)**, los módulos `team` y `settings` del dashboard de negocio y el
pase final de calidad visual/accesibilidad de toda la app. Requiere F1 (puede correr en
paralelo a F3–F5).

## 1. W1 — Landing `/` (`[locale]/(public)/page.tsx`)

Estática (Server Components), sin datos de BD; único código cliente: animaciones Magic UI
y el header sticky.

### Setup Magic UI

Componentes instalados vía registry shadcn (skill `magic-ui`) en `src/components/ui/`:

```bash
pnpm dlx shadcn@latest add @magicui/blur-fade @magicui/text-animate @magicui/shimmer-button @magicui/bento-grid @magicui/number-ticker @magicui/animated-beam @magicui/border-beam
```

### Estructura

```text
(public)/page.tsx  +  _components/
├─ landing-view.tsx              # secuencia de secciones
├─ landing-header.tsx            # sticky: logo H HOME360, nav anclas (Cómo funciona / Para negocios / Garantías / Precios), Iniciar sesión, CTA Registra tu negocio
├─ hero-section.tsx              # badge "Diagnóstico con IA + pagos protegidos", titular con BlurFade/TextAnimate, subtítulo, CTAs
├─ hero-visual.tsx               # mockup de la app + AnimatedBeam foto → diagnóstico → escrow
├─ features-section.tsx          # BentoGrid 3 tarjetas: Diagnóstico IA / Pagos protegidos / Garantías reales
├─ feature-card.tsx              # icono lucide + título + descripción, BorderBeam en hover
├─ how-it-works-section.tsx      # 3 pasos numerados (ancla "Cómo funciona")
├─ metrics-section.tsx           # NumberTicker: negocios activos, órdenes, GMV (cifras estáticas de marketing)
├─ pricing-section.tsx           # los 3 planes (reusa datos estáticos, no BD; link a /register)
├─ cta-section.tsx               # cierre: Registra tu negocio + Descargar la app
└─ landing-footer.tsx
```

### Reglas de motion

- Animaciones **solo aquí** — dashboard y admin permanecen sobrios.
- Entradas con `BlurFade` escalonado (delay 80–120 ms entre elementos), una sola vez
  (`inView`), nada en loop salvo `AnimatedBeam`.
- `ShimmerButton` únicamente en el CTA primario del hero.
- Todo respeta `prefers-reduced-motion` (los wrappers de Magic UI se auditan; si alguno
  no lo respeta, se envuelve en un `MotionSafe` propio que colapsa a render estático).
- Estética intacta: fondo `#f4f4f5`, texto `#09090b`, acentos zinc — sin gradientes de
  color ajenos al diseño.
- Copy completo en `landing.json` (es/en).

## 2. Dashboard `team` y `settings`

### `/dashboard/team` — router `team` (activeBusiness)

`list` / `create` / `update` / `delete` de `Worker` (con `assertPlanLimit("workers")`).
Módulo con el patrón estándar: tabla (nombre, servicios asignados, sucursal), Sheet de
alta/edición, ConfirmDialog al eliminar (bloquea si es el único asignado a un servicio
activo → `CONFLICT`).

### `/dashboard/settings` — router `businessSettings` (business)

`get` / `update` del perfil del negocio: nombre, tipo, notas de garantía (solo lectura de
`guaranteeType` — cambiarla requiere re-aprobación admin, fuera de alcance), y datos del
dueño (nombre, cambio de contraseña con verificación de la actual).

## 3. Pase final de calidad (toda la app)

Checklist ejecutado pantalla por pantalla (W1–W13), aplicando las skills
`web-design-guidelines`, `better-accessibility`, `ui-typography` e `impeccable`:

- **Accesibilidad**: navegación completa por teclado (sheets, dialogs, dropdowns, tabs);
  focus visible; labels/aria en formularios e íconos-botón; contraste AA (revisar badges
  ámbar y texto muted sobre zinc); `alt` en imágenes.
- **Tipografía**: comillas/guiones correctos en ambos locales, tabular-nums en montos y
  tablas, jerarquía de headings sin saltos.
- **Estados**: cada ruta con `loading.tsx` (skeleton fiel al layout final), `error.tsx`
  (mensaje + retry) y empty states con CTA.
- **i18n**: barrido de strings hardcodeados (grep de literales en JSX); ambos locales
  completos; fechas/moneda formateadas en 100 % de los casos.
- **Responsive**: sidebar colapsa a Sheet en < 1024 px; tablas con scroll horizontal
  contenido; master-detail de disputas apila en móvil.
- **Consistencia**: mismos verbos de acción y orden en toasts, dialogs y botones en toda
  la app; `StatusBadge` con paleta unificada de estados.

## 4. Verificación

1. `pnpm typecheck` · `pnpm check` · `pnpm vitest run` · `pnpm build` (primera build de
   producción completa del proyecto).
2. Manual: landing en es/en, móvil y desktop; con `prefers-reduced-motion` activo la
   landing no anima; navegación por anclas del header; los CTAs llevan a `/register`.
3. Recorrido completo de las 13 pantallas contra el diseño
   (`HOME360 Web.dc.html`) como revisión final lado a lado.

### Criterios de aceptación

- [ ] Landing replica las secciones y jerarquía de W1 con animaciones Magic UI sutiles.
- [ ] `prefers-reduced-motion` deja la landing 100 % estática.
- [ ] Team y settings de negocio operativos con límites de plan.
- [ ] Checklist de calidad completado en las 13 pantallas.
- [ ] `pnpm build` en verde; sin `any`; sin strings hardcodeados; contrato `TrpcResponse`
      uniforme en todo el `appRouter`.
