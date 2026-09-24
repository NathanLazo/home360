---
name: HOME360
description: Marketplace de mantenimiento del hogar con pago en escrow — sistema único inspirado en Vercel (ink + hairlines + Geist), con primary de metal líquido y Liquid Glass como firma.
colors:
  ink: "#171717"
  on-ink: "#ffffff"
  body: "#4d4d4d"
  mute: "#888888"
  hairline: "#ebebeb"
  hairline-strong: "#a1a1a1"
  canvas: "#ffffff"
  canvas-soft: "#fafafa"
  canvas-soft-2: "#f5f5f5"
  link: "#0070f3"
  link-deep: "#0761d1"
  link-soft: "#d3e5ff"
  error: "#ee0000"
  error-soft: "#f7d4d6"
  error-deep: "#c50000"
  warning: "#f5a623"
  warning-soft: "#ffefcf"
  warning-deep: "#ab570a"
  success: "#1a9b50"
  success-soft: "#d9f2e3"
  success-deep: "#0f7b3f"
  selection-bg: "#171717"
  selection-fg: "#f2f2f2"
  mesh-develop: "#007cf0 → #00dfd8"
  mesh-preview: "#7928ca → #ff0080"
  mesh-ship: "#ff4d4d → #f9cb28"
typography:
  display-hero: { fontFamily: "Geist", fontSize: "clamp(2.75rem, 6.5vw, 4.5rem)", fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02 }
  display-xl: { fontFamily: "Geist", fontSize: "48px", fontWeight: 600, letterSpacing: "-2.4px", lineHeight: "56px" }
  display-lg: { fontFamily: "Geist", fontSize: "32px", fontWeight: 600, letterSpacing: "-1.28px", lineHeight: "40px" }
  display-md: { fontFamily: "Geist", fontSize: "24px", fontWeight: 600, letterSpacing: "-0.96px", lineHeight: "32px" }
  display-sm: { fontFamily: "Geist", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.6px", lineHeight: "26px" }
  copy: { fontFamily: "Geist", fontSize: "16px", fontWeight: 400, lineHeight: "24px" }
  copy-sm: { fontFamily: "Geist", fontSize: "14px", fontWeight: 400, letterSpacing: "-0.28px", lineHeight: "20px" }
  label: { fontFamily: "Geist Mono", fontSize: "12px", fontWeight: 500, lineHeight: "16px" }
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "100px"
spacing:
  unit: "4px"
motion:
  ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
---

# Design System: HOME360

> Fuente de verdad del sistema visual. Tokens en `src/styles/globals.css`;
> primitivas en `src/components/ui/button.tsx`, `src/components/metal/`,
> `src/components/glass/`. Ejecución normativa en `spec/DESIGN-DIRECTIVE.md`.

## 1. Overview

**Norte creativo: "Herramienta de precisión, con un solo metal."**

HOME360 custodia el dinero de una persona mientras otra entrega trabajo verificable.
El sistema es **inspirado en Vercel**: lienzo claro, tinta casi negra, hairlines en
vez de bordes pesados, Geist en todo y elevación por sombras apiladas. Sobre esa base
neutra hay **un giro propio**: el primary es **metal líquido** (tinta con aro de
cromo), y en los momentos firma el metal se sienta dentro de **Liquid Glass**.

**Una sola personalidad, dos intensidades.** Por decisión del product owner la paleta
de marca navy/gold/cream queda **retirada**; Fraunces solo como acento editorial de la landing (palabras `*acento*` de headings display, `accentClass`). Landing, dashboard, admin,
corporate y auth comparten los mismos tokens ink/zinc. La landing sube la intensidad
(tipografía display grande, mesh gradient atmosférico solo en el hero, CTAs pill,
beams) pero no tiene paleta propia.

**Rasgos:**
- Ink + hairline + Geist. El color aparece solo cuando significa algo (link, error,
  warning, éxito) o como atmósfera del hero de la landing.
- Mono = dato verificable: precios, métricas, IDs, pasos y eyebrows en Geist Mono.
- Metal = la acción que la pantalla pide. Glass = la cromática flotante que la sostiene.
- Motion decelerado (`cubic-bezier(0.22, 1, 0.36, 1)`), overshoot 0 salvo micro-éxitos.
- Espaciado en múltiplos de 4 px.

## 2. Color

Todos los tokens viven en `:root` (claro) y se redefinen bajo `.dark` (bandas oscuras
de la landing, superficies `tone="dark"`). En Tailwind cada rol es una utilidad de
color (`bg-canvas`, `text-body`, `border-hairline`, `text-link-deep`…).

| Rol | Token / utilidad | Valor claro | Uso |
|---|---|---|---|
| Ink / primary | `ink`, `primary` | #171717 | Titulares, texto por defecto, core del botón primario |
| On ink | `on-ink`, `primary-foreground` | #ffffff | Texto sobre ink |
| Body | `body`, `muted-foreground` | #4d4d4d | Copy secundario, descripciones (8.1:1 sobre canvas-soft) |
| Mute | `mute` | #888888 | Terciario: placeholders, metadatos no esenciales, texto ≥18 px (3.4:1 — **nunca** copy de 14 px esencial) |
| Hairline | `hairline`, `border`, `input` | #ebebeb | Bordes y divisores |
| Hairline strong | `hairline-strong` | #a1a1a1 | Borde de `outline`, hover de inputs |
| Canvas | `canvas`, `card`, `popover` | #ffffff | Cards, dialogs, inputs, menús |
| Canvas soft | `canvas-soft`, `background` | #fafafa | **Fondo de página** (y del panel de la herramienta) |
| Canvas soft 2 | `canvas-soft-2`, `accent`, `muted`, `secondary`, `sidebar` | #f5f5f5 | Inset, hover de menús, lienzo del shell bajo el panel (dark: `oklch(0.08 0 0)`) |
| Link | `link`, `ring` | #0070f3 | Links sobre canvas blanco, anillo de foco |
| Link deep | `link-deep` | #0761d1 | Texto link sobre cualquier superficie (el #0070f3 da 4.36:1 sobre canvas-soft) |
| Link soft | `link-soft` | #d3e5ff | Fondo de estado info |
| Error | `error`, `destructive` | #ee0000 / soft #f7d4d6 / deep #c50000 | Destructivo (texto blanco 4.53:1), hover `error-deep` |
| Warning | `warning` | #f5a623 / soft #ffefcf / deep #ab570a | `warning` solo como relleno/icono; texto en `warning-deep` |
| Success | `success` | #1a9b50 / soft #d9f2e3 / deep #0f7b3f | Estados liberado/pagado; texto en `success-deep` |
| Selección | `selection-bg/fg` | #171717 / #f2f2f2 | `::selection` global |
| Tinte de acción | `tint-sky` / `tint-sky-soft` / `tint-lime` / `tint-lime-soft` / `tint-deep` | #4f9fd8 / #dceffc / #a8d96c / ≈#eef7de / #263b4a | **Paleta "Azul + Limón suave" (owner).** El único acento cromático del producto: beams (`BeamFrame`), barras de progreso (fill sky sobre track sky-soft), notch activo del sidebar, glint del aro de metal, lavado `bg-tint-wash`. `tint-deep` es el texto sobre los tonos soft. Nunca como color de texto de cuerpo ni como estado |

**Decisión success:** el sistema Vercel usa azul para éxito, pero la app ya distingue
`info` (azul) de `success` en badges de estado del escrow. Para no dar dos significados
a un mismo tono, **success se queda verde** (familia `success-*`) y **info usa la
familia `link-*`**. `StatusBadge` puede migrar de `emerald-*/amber-*/red-*/blue-*` a
`success-*/warning-*/error-*/link-*` (soft = fondo, deep = texto).

**Mesh gradient (solo hero de landing).** `--mesh-sky-*` (#4f9fd8 → sky claro) y
`--mesh-lime-*` (#a8d96c → limón claro), el tinte de acción llevado a atmósfera,
compuestos en la utilidad `bg-mesh-hero`. Es un fondo atmosférico a escala de hero,
difuminado y tenue. **Nunca** miniaturizado: ni en chips, iconos, botones, bordes ni
texto (`background-clip: text` sigue prohibido). Su hermano de producto es
`bg-tint-wash`: el mismo par sky/lime por debajo del 15 %, bajo la cabecera de cada
página del panel y en los `EmptyState`.

> Decisión del owner: el hero de la landing usa el mesh + CTA liquid metal `chromatic`
> a plena intensidad, y las palabras de acento del título en Fraunces gris.

### Named Rules
**La Regla del Color con Significado.** Un color, un significado. Azul = link/foco/info;
rojo = error/destructivo; ámbar = advertencia; verde = éxito. Ninguno decora. El tinte
de acción (sky/lime) tiene un solo significado propio: **"por aquí sigue el flujo"**
(la acción de entrada de una pantalla, el progreso, la sección activa). Nunca marca un
estado ni sustituye a `link-*`.

**La Regla del Gris Terciario.** `mute` (#888) no porta información esencial en tamaño
de cuerpo. El copy secundario usa `muted-foreground` (= `body`).

## 3. Typography

**Una sola familia: Geist.** Geist Sans para todo; Geist Mono para etiquetas técnicas,
eyebrows, código y cifras verificables. Excepción (decisión del owner): Fraunces solo como acento editorial de la landing (palabras `*acento*` de headings display, `accentClass`); fuera de la landing ninguna serif.
Pesos 400 / 500 / 600 — **600 es el techo**; `font-bold`, `font-extrabold` y
`font-black` están remapeados a 600 en `@theme` y `<b>/<strong>` renderizan 600.
Sentence case siempre.

| Utilidad | Tamaño / interlínea | Tracking | Uso |
|---|---|---|---|
| `text-display-hero` | clamp(44→72 px) / 1.02 | -0.05em | `h1` del hero (solo landing) |
| `text-display-xl` | 48 / 56 | -2.4 px | `h1` de landing, títulos de sección grandes |
| `text-display-lg` | 32 / 40 | -1.28 px | `h2` de sección, `h1` de página de dashboard si aplica |
| `text-display-md` | 24 / 32 | -0.96 px | `h2` de dashboard, títulos de dialog grandes |
| `text-display-sm` | 20 / 26 | -0.6 px | `h3`, títulos de card |
| `text-copy` | 16 / 24 | 0 | Cuerpo de landing |
| `text-copy-sm` | 14 / 20 | -0.28 px | Cuerpo de la herramienta, controles |
| `font-mono text-label` | 12 / 16 | 0 | Eyebrows, etiquetas de dato (uppercase opcional con `tracking-wide`) |

Los `text-display-*` ya fijan peso 600 y tracking; no sumes `font-bold` ni
`tracking-*`. `tabular-nums` en toda cifra que anime o cambie.

**Acento en titulares de landing** (`*acento*` en los mensajes): mismo Geist,
contraste por tinta — `font-normal text-mute` (`accentClass` en
`(public)/_components/landing-styles.ts`). Sin serif, sin gradiente.

## 4. Radii

| Token | px | Uso |
|---|---|---|
| `rounded-xs` | 4 | Chips mínimos |
| `rounded-sm` | 6 | Casos puntuales (logos, thumbnails) |
| `rounded-md` | 8 | Tooltips de charts |
| `rounded-lg` | 12 | Items de menú/select/command y su highlight, dialogs, pricing, cards grandes, paneles glass |
| `rounded-xl` | 16 | Paneles internos con borde (en sheets/forms), alerts, popovers de menú/select, textarea, superficies hero, consolas de landing |
| `rounded-pill` | 100 | Botones, inputs, selects, search, tabs, ítems del sidebar (y su lente), docks glass |
| `rounded-2xl` | 20 | **Cards** (`Card`, KPI, cards de tabla — la tabla hereda el recorte), link cards, dialogs |
| `rounded-full` | — | Avatares, dots |

`--radius` = 8 px (md). El mapeo shadcn es sm 6 · md 8 · lg 12 · xl 16.

## 5. Elevation

Elevación = **sombras apiladas + hairline inset**, nunca una sombra pesada única.

| Nivel | Utilidad | Receta |
|---|---|---|
| L1 | `shadow-hairline` | `0 0 0 1px #00000014` |
| L2 | `shadow-subtle` | L1 + `0 1px 1px #00000005, 0 2px 2px #0000000a` |
| L3 | `shadow-soft` | L1 + `0 2px 2px #0000000a, 0 8px 8px -8px #0000000a` |
| L4 | `shadow-float` | L1 + `0 2px 2px #0000000a, 0 8px 16px -4px #0000000a` |
| L5 | `shadow-modal` | L1 + `0 1px 1px #00000005, 0 8px 16px -4px #0000000a, 0 24px 32px -8px #0000000f` |

Las utilidades nombradas **incluyen** la hairline: úsalas en superficies **sin**
`border`. Los defaults de Tailwind se remapearon a las mismas pilas **sin** hairline
para las primitivas shadcn que ya dibujan `border`: `shadow-xs` ≈ L1 suave, `shadow-sm`
= L2, `shadow-md` = L4 (menús), `shadow-lg` = L5 (Dialog/Sheet). En `.dark` la hairline
inset pasa a blanco 10 %.

## 6. Components

### Botones (`~/components/ui/button`)

| Variant | Aspecto |
|---|---|
| `default` | **Metal líquido estático**: core ink + aro de cromo 1 px (`metal-rim`) + brillo superior + `shadow-metal` |
| `secondary` | Canvas blanco + hairline + `shadow-xs` |
| `outline` | Transparente + `hairline-strong` |
| `ghost` | Solo hover `accent` |
| `destructive` | #ee0000, hover `error-deep` |
| `link` | `link-deep`, subrayado en hover |

Tamaños (finos, decisión del owner): `xs` 24 · `sm` 28 · `default` 32 · `lg` 36 ·
`icon*` equivalentes · **`pill` 40 (CTA de marketing)** · **`pill-sm` 32 (nav/dock)**.
Texto 13 px (12 en `xs`/`sm`), íconos 14 px. **Todos los botones son pill**. No
fuerces alto con `min-h-*`/`h-*`/`size-*` en call-sites: en punteros táctiles un
`::after` invisible extiende el área de toque a ≥44 px sin agrandar el botón. Press `active:scale-[0.97]`; foco `ring-2 ring-ring` con offset.

**Metal estático vs vivo.**
- Estático (default, gratis): todo botón primario. CSS puro, SSR, sin WebGL.
- Vivo: `metal="live"` envuelve el botón en `MetalAction` (anillo WebGL de
  `metal-fx`); `metal="bend"` añade la abolladura líquida bajo el cursor. **Presupuesto:
  ≤1–2 acciones vivas por pantalla** (la acción decisiva: guardar settings, resolver
  disputa, retirar, CTA del hero). `bend` solo en **la** CTA clave. Un botón
  `disabled` nunca lleva anillo vivo. `metalClassName` pasa layout al wrapper
  (`w-full`, `flex-1`). Sin WebGL2, en el primer paint y con reduced motion se ve
  solo el aro estático.
- Reutiliza el cromo: `metal-rim` (aro sobre core `--metal-core`, por defecto
  `--primary`), `bg-metal` (relleno plata claro para badges/pills/indicadores activos,
  texto `text-ink` ≥8:1), tokens `--metal-1…5`, `--metal-rim`, `--metal-fill`,
  `--metal-gloss`. Para cambiar el core en hover: `hover:[--metal-core:…]`. No pongas
  `bg-*` sobre un `metal-rim` (pisa el `background`).
- `MetalPill` (label corto vivo) y `MetalRing` (anillo sobre avatar/ícono) siguen en
  `~/components/metal`; cuentan para el mismo presupuesto.

### Inputs
Mismo grosor y forma que los botones: alto 32 (`sm` 28), **pill**, hairline, fondo
canvas, 13 px (16 en móvil para evitar zoom iOS). `Textarea` usa radio 16 (`rounded-xl`).
Select, search (`SearchInput`), tabs y `CommandInput` siguen la misma escala; no fuerces
`min-h-*`/`h-*` en call-sites. Hover `hairline-strong`, foco `border-ring` + anillo azul. Label
siempre visible; error debajo con `aria-describedby` + `aria-invalid`.

### Cards
`Card`: canvas + hairline + `shadow-sm`, radio 20 (`rounded-2xl`); las tablas viven dentro de una `Card` con `overflow-hidden`, así heredan el radio.
Sin glass, nunca.

### Liquid Glass (`~/components/glass`)
- `GlassSurface` — superficie Liquid Glass (`@samasante/liquid-glass`) con óptica
  sutil propia (refracción baja, frost 10 px, sheen suave) sobre tinte canvas
  translúcido y `shadow-float`. Props: `tone` (`light` | `dark`), `radius`
  (`sm|md|lg|xl|pill`), `optics` (escape hatch), `className` (layout normal) y
  atributos HTML. Chromium refracta el DOM vivo; Safari/Firefox esmerilan + tiñen +
  iluminan el borde.
- `GlassDock` — **la firma**: contenedor glass (`shape="pill"` para nav/toolbar,
  `"panel"` para barra de guardado) con un slot `action` para **la** acción de metal.

```tsx
<GlassDock aria-label={t("toolbar")} action={
  <Button size="pill-sm" metal="live">{t("save")}</Button>
}>
  {secondaryControls}
</GlassDock>
```

**Patrones de la herramienta (dashboard/admin/corporate):**
- Shell (`src/components/app-shell/`): la herramienta es una **pantalla dentro de la
  pantalla**. Sidebar `variant="inset"` sobre el lienzo `sidebar`; el panel
  (`AppShellInset`) flota con `m-2 ml-0`, `rounded-xl`, hairline `border` y `shadow-md`,
  alto fijo `100svh - 1rem` y `overflow-hidden`: solo desplaza `AppShellContent`
  (`max-w-7xl`, `p-4 sm:p-6 lg:p-8`, destino del skip link). Arriba `AppShellHeader`
  (40 px en desktop, 44 en móvil; canvas al 92 % + blur, sin glass) con trigger,
  hairline vertical y `AppShellBreadcrumb` "Workspace › Sección" (la hoja hace
  crossfade de 150 ms smooth-out al navegar; instantáneo con reduced motion). Abajo
  `AppShellFooter` (36 px, solo desktop, `rounded-b-xl`): carril izquierdo para accesos
  rápidos/burbujas de mensajes, derecha idioma y el slot `data-slot="agent-dock"`
  reservado para el agente de IA. En móvil el panel es full-bleed, sin footer, y el
  idioma sube al header. Identidad: las tres áreas usan el sidebar claro; admin se
  distingue por su chip de rol (`bg-metal`) junto al breadcrumb.
- Sidebar: notch activo de metal **estático** (`SidebarActiveIndicator`, `bg-metal`)
  que se desliza entre ítems (250 ms smooth-out, instantáneo con reduced motion);
  sobre el ítem activo viaja además un **lente de selección** (`SidebarActiveLens`
  → `GlassLens`): gota Liquid Glass transparente con filo `metal-hairline`, que
  dobla el propio icono/label en el borde (Chromium); marca "H" con `metal-rim`. Chips de identidad (rol, plan actual) = `bg-metal`
  estático, nunca `MetalPill` vivo en cromática persistente.
- Menús del header (usuario, idioma, sucursal): `DropdownMenuContent glass` /
  `SelectContent glass` → `MenuGlassHighlight`: tinte accent bajo la opción
  resaltada + `GlassLens` encima, deslizándose con el foco (150 ms). Punto de radio
  = `metal-rim` (núcleo ink, aro plateado).
- Sheets con formulario: `SheetFormDock` (GlassDock `panel` sticky; los campos
  scrollean debajo) con submit `metal="live"`. El CTA de la página que abre el
  sheet cede su anillo con `metalActive={!sheetOpen}` (mismo patrón en diálogos:
  retirar, aprobar). `ConfirmDialog decisive` = confirmación de dinero con metal vivo.

**Dónde sí:** cromática flotante/sticky sobre contenido — nav de la landing, barras de
guardado sticky, toolbars flotantes, opcionalmente popovers/dropdowns. **Dónde no:**
tablas densas, cards, formularios, fondos de sección. **Glass + metal juntos = la
firma, máximo una vez por pantalla.** Nunca glass sobre glass.

**Lente de selección (`GlassLens`):** sin frost ni velo (el texto debajo queda
nítido en todos los navegadores), click-through, `aria-hidden`; el estado real lo
portan `aria-current` / foco. Sin material → solo el filo de metal.

**Fallbacks:** primer paint del servidor, `prefers-reduced-transparency: reduce` y
`prefers-contrast: more` → la misma caja en canvas sólido + hairline (sin layout
shift). Reduced motion → sin refracción (solo frost + tinte). La óptica nunca se anima.

### Beam frame y bot avatars
- `BeamFrame` (`~/components/beam`): el tinte de acción en movimiento — una luz cónica
  sky → lime que orbita el borde de un elemento (`orbit`) o respira como halo
  (`pulse`). CSS puro (`@property --beam-angle`), sin WebGL y fuera del presupuesto de
  metal vivo. Tamaños `sm` (botones), `md` (cards), `lg` (marcos hero); `strength`,
  `duration`, `active`. El radio se pasa por `className` (`rounded-pill`,
  `rounded-xl`…). Estados: `live`, `still` (reduced motion: aro fijo, sin glow) y
  `off`. Primer render siempre `still`.
- `Button beam`: la acción de entrada del flujo principal de una pantalla (nuevo
  producto, retirar, la acción clave del overview) lleva el beam en vez del aro vivo;
  `beamActive={false}` lo apaga mientras un diálogo toma el relevo. Nunca se apila con
  `metal="live"`.
- `LandingBeam` (solo landing): alias de `BeamFrame`. Presupuesto: consola del hero,
  plan recomendado y CTA final — no más.
- `UserBotAvatar` (`bot-avatars`): avatar determinista por seed para usuarios sin foto.
  `interactive` solo fuera de listas densas; tamaños 24–40 px.

### Estados de pantalla
Loading (skeleton con forma real), empty (`EmptyState` con CTA), error (reintento),
éxito (toast con verbo en pasado). Obligatorios en toda pantalla de herramienta.

## 7. Motion

- **Ease-out normativo: `cubic-bezier(0.22, 1, 0.36, 1)`** (transitions.dev "smooth
  out"). La utilidad `ease-out` de Tailwind ya es esta curva; en JS usa
  `MOTION_EASE.smoothOut` (`~/components/motion/motion-tokens`).
- Duraciones en `MOTION_DURATION_MS`: 150 (hover/press/cierre), 250 (apertura de
  dropdown/modal), 350–400 (paneles), ≤500 (énfasis). UI ≤300 ms.
- Overshoot solo en micro-éxitos (`MOTION_EASE.bounce`: check, badge), nunca en cierres.
- Dashboard/admin/corporate: sin entradas por scroll; motion solo como feedback.
  `ToolMotionProvider` (`MotionConfig reducedMotion="user"`) envuelve los shells.
  Feedback vigente: press 0.97, fila clicable `active:bg-canvas-soft-2`, relleno de
  `StatusBadge` 150 ms, punto de "cambios sin guardar", tooltip de chart 120 ms
  (scale 0.97), revelado de barras 300 ms, check dibujado en `/pay/success`.
- Nunca `transition: all`; anima `transform`/`opacity` (y color/sombra en hover).

## 8. Budgets por pantalla

| Recurso | Máximo |
|---|---|
| Metal vivo (`metal="live"`/`MetalAction`/`MetalRing`/`MetalPill`) | 1–2 |
| `metal="bend"` | 1 |
| Glass + metal (firma, `GlassDock`) | 1 |
| Superficies glass en total | 2 (p. ej. nav + popover) |
| Lentes de selección (`GlassLens`) | 1 por lista (sidebar, menú abierto); no cuentan como superficie |
| `LandingBeam` | 3 en toda la landing |
| `BeamFrame` / `Button beam` en producto | 1 por pantalla (la acción de entrada del flujo) |
| Mesh gradient | 1, solo hero de landing |
| `bg-tint-wash` | cabecera del panel (shell) + `EmptyState`; nunca en cards de datos |

## 9. Accesibilidad y preferencias

- AA verificado con números: ink/canvas-soft 17.2:1, body/canvas-soft 8.1:1,
  link-deep/canvas-soft ≥5:1, blanco/#ee0000 4.53:1, deep/soft de estados ≥4.5:1.
- Foco visible siempre: anillo `ring` azul 2 px con offset, también sobre metal y glass.
- `prefers-reduced-motion`: sin metal vivo, sin refracción, sin beams, sin entradas;
  mismo layout y contenido.
- `prefers-reduced-transparency` / `prefers-contrast: more`: glass → sólido.
- Color nunca es el único portador de información.

## 10. Frontera D7 (actualizada)

La frontera de **paletas** se cierra: por decisión del owner, `--brand-*`
(navy/gold/cream/gray) queda retirado y **la landing comparte el sistema
ink/zinc**. Lo que sigue siendo exclusivo de `src/app/[locale]/(public)/**`: el mesh
gradient (`bg-mesh-hero`), `text-display-hero`, Magic UI y las entradas por scroll.
Dashboard/admin/corporate/auth no los usan.

El **tinte de acción** (`tint-sky`/`tint-lime`, decisión del owner) cruza la frontera a
propósito: es el mismo par en el mesh del hero, en los `LandingBeam`, en `Button beam`
del panel, en el progreso y en el lavado `bg-tint-wash`. Lo que cambia entre superficies
es la intensidad (atmósfera en la landing, 1 beam y un lavado <15 % en el panel), no la
paleta.

## 11. Do's and Don'ts

**Do:** usar tokens semánticos (`bg-canvas`, `text-body`, `shadow-float`) en vez de
valores sueltos · componer cifras en Geist Mono con `tabular-nums` · dar a cada
pantalla una sola acción de metal decisiva · respetar los fallbacks de glass.

**Don't:** serif fuera de los acentos de la landing · peso 700 · `--brand-*` · mesh gradient fuera
del hero · glass sobre tablas/cards o glass sobre glass · más de 2 metales vivos ·
`bg-*` sobre `metal-rim` · `mute` para copy esencial de 14 px · `transition: all` ·
strings hardcodeados.
