---
name: HOME360
description: Marketplace de mantenimiento del hogar con pago en escrow — landing Premium (brand) y dashboard Corporate (zinc), separados por la frontera D7.
colors:
  brand-navy: "#0d1b2a"
  brand-gold: "#c8a96e"
  brand-cream: "#f5f0e8"
  brand-gray: "#8a9bb0"
  zinc-background: "oklch(0.967 0.001 286.375)"
  zinc-foreground: "oklch(0.141 0.005 285.823)"
  zinc-primary: "oklch(0.21 0.006 285.885)"
  zinc-muted-foreground: "oklch(0.552 0.016 285.938)"
  zinc-border: "oklch(0.92 0.004 286.32)"
  zinc-card: "oklch(1 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)"
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.08em"
  metric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 600
    letterSpacing: "-0.02em"
rounded:
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
spacing:
  unit: "4px"
  section: "5rem"
  section-lg: "7rem"
components:
  cta-gold:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.brand-navy}"
    rounded: "{rounded.lg}"
  button-primary:
    backgroundColor: "{colors.zinc-primary}"
    textColor: "oklch(0.985 0 0)"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.zinc-card}"
    textColor: "{colors.zinc-foreground}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.zinc-card}"
    textColor: "{colors.zinc-foreground}"
    rounded: "{rounded.md}"
---

# Design System: HOME360

## 1. Overview

**Creative North Star: "La bóveda del oficio"**

HOME360 custodia el dinero de una persona mientras otra entrega trabajo manual verificable. El sistema visual traduce eso literalmente: el navy es la bóveda (peso, cierre, custodia), el gold es el sello (escaso, solo donde hay acción o dinero custodiado), y el mono es el comprobante (toda cifra verificable se compone en Geist Mono). Nada decorativo que no diga algo verdadero sobre custodia, oficio o confianza.

El sistema vive partido en dos personalidades bajo una frontera inviolable (D7, `spec/08-business-model-alignment.md`): la landing pública (`(public)/`) habla en registro **Premium** con la paleta de marca y Fraunces como display; dashboard, admin y auth hablan en registro **Corporate** con zinc shadcn, donde la herramienta *está*, no se revela. Los tokens `--brand-*` jamás cruzan a dashboard; los tokens zinc jamás se reescriben para complacer a la landing.

Rechaza explícitamente el default reconocible de diseño IA (titular Geist sobre cream con acento gold), el SaaS genérico de productividad, los gradientes ajenos al sistema y el motion elástico: un producto que custodia dinero ajeno no rebota.

**Key Characteristics:**
- Dos registros, una disciplina: Premium (brand) en landing, Corporate (zinc) en herramienta.
- Mono = dato verificable: precios, métricas, pasos y etiquetas de dato en Geist Mono.
- Gold escaso y significativo: ≤4 apariciones por pantalla; siempre acción o custodia.
- Motion decelerado, overshoot 0, reduced-motion como requisito de entrega.
- Espaciado en múltiplos de 4 px; agrupamiento por espacio, no por líneas.

## 2. Colors

Cuatro tokens de marca del brandbook para la landing; escala zinc neutra de shadcn para la herramienta.

### Primary
- **Navy bóveda** (#0d1b2a): fondo del hero y del CTA final de la landing — los dos momentos de mayor peso. Nunca dos secciones navy consecutivas. También es el color del texto sobre gold.
- **Zinc ink** (oklch(0.21 0.006 285.885)): el primary de dashboard/admin; botones primarios y acentos de la herramienta.

### Secondary
- **Gold sello** (#c8a96e): exclusivo de acción y custodia — CTA primario, subrayado del wordmark, borde del badge del hero, BorderBeam en hover, acento del plan recomendado. Prohibido como fondo amplio, texto de párrafo o icono decorativo.

### Neutral
- **Cream** (#f5f0e8): fondo de las secciones de contenido de la landing (features, how-it-works, pricing), alternando con navy.
- **Brand gray** (#8a9bb0): texto secundario sobre navy, nunca un quinto acento.
- **Zinc background** (oklch(0.967 0.001 286.375)) / **Zinc card** (oklch(1 0 0)) / **Zinc border** (oklch(0.92 0.004 286.32)): la superficie de trabajo del dashboard.
- **Zinc foreground** (oklch(0.141 0.005 285.823)) y **muted** (oklch(0.552 0.016 285.938)): texto principal y secundario de la herramienta.
- **Destructive** (oklch(0.577 0.245 27.325)): acciones destructivas, siempre detrás de `ConfirmDialog` y nunca solo con color.

### Named Rules
**La Regla D7.** Los tokens `--brand-*` solo existen dentro de `src/app/[locale]/(public)/**`. Cualquier tarea que necesite cruzarlos a dashboard/admin está mal planteada: se reporta y se detiene.

**La Regla del Gold Escaso.** Gold sobre cream ≈ 1.9:1 — nunca texto ni iconografía portadora de significado; solo bordes/filetes ≥2 px acompañados de otro indicador. El texto del CTA gold es navy. Más de ~4 apariciones de gold en una pantalla: sobra una.

## 3. Typography

**Display Font:** Fraunces (variable, ejes `opsz`/`SOFT`, con fallback ui-serif/Georgia)
**Body Font:** Geist Sans (con fallback system-ui)
**Label/Mono Font:** Geist Mono

**Character:** Una serif de corte de herramienta —terminaciones angulosas, contraste alto— que evoca oficio y permanencia, sobre un cuerpo sans neutro. El mono no es decoración: marca "esto es un dato verificable".

### Hierarchy
- **Display** (700, clamp(2.5rem, 6vw, 4.5rem), tracking -0.02em): h1 del hero, solo en `(public)/`. `text-balance`.
- **Headline** (600, clamp(1.875rem, 3.5vw, 2.75rem), tracking -0.015em): h2 de sección de landing, cara display.
- **Title** (600, 1.125rem, tracking -0.01em): h3 de card/paso, siempre sans. La cara display nunca baja de h2.
- **Body** (400, 1rem–1.0625rem, lh 1.6): medida de 60–75 caracteres, `text-pretty` en párrafos largos.
- **Label** (500, 0.75rem, tracking 0.08em, uppercase, mono): eyebrows y etiquetas de dato.
- **Metric** (600 mono, clamp(2rem, 4vw, 3rem), `tabular-nums`): cifras de métricas y precios; obligatorio `tabular-nums` en toda cifra que anime o cambie.

### Named Rules
**La Regla del Comprobante.** Todo número que represente dinero, métrica o paso verificable se compone en Geist Mono. Sans para prosa, serif para titulares de landing, mono para datos.

**La Regla del Display Contenido.** `--font-display` solo en h1/h2 dentro de `(public)/`, aplicada con clase local del módulo. Nunca en dashboard, body, botones ni h3.

## 4. Elevation

Plano por defecto. Las superficies están planas en reposo; la profundidad de la landing la da la alternancia tonal cream → navy → cream, y en el dashboard la dan `card` blanco sobre `background` zinc con borde de 1 px. La sombra existe solo como respuesta a estado: hover de card (sombra + borde, nunca traslación), hover de CTA (elevación de sombra + escala ≤2 %), y superficies flotantes (Dialog, Sheet, Popover).

### Named Rules
**La Regla del Reposo Plano.** Si un elemento tiene sombra sin que el usuario haya hecho nada, la sombra sobra. Sombras aparecen por hover, foco o flotación — no por decoración.

## 5. Components

Carácter: **sobrios y firmes** — refinados, sin adorno, con feedback breve y decidido (≤150 ms).

### Buttons
- **Shape:** esquinas moderadas (0.4–0.5rem); nunca pill salvo tags.
- **Primary (landing):** gold sobre navy-texto (#c8a96e / #0d1b2a), `ShimmerButton` solo en el CTA primario del hero — una vez en todo el producto.
- **Primary (dashboard):** zinc ink con texto casi blanco; shadcn `Button` estándar.
- **Hover / Focus:** hover ≤150 ms (sombra + escala ≤2 %), `active:scale-[0.98]`, foco visible siempre; submit con estado pendiente y deshabilitado.

### Cards / Containers
- **Corner Style:** 0.5rem (`--radius`); jamás 24 px+.
- **Background:** zinc card blanco sobre background zinc; en landing, superficies sobre cream o navy según sección.
- **Shadow Strategy:** plano en reposo; hover = sombra + borde (ver Elevation). `BorderBeam` solo en hover de feature card de landing.
- **Border:** 1 px zinc-border.
- **Internal Padding:** múltiplos de 4 px, típicamente 16–24 px.

### Inputs / Fields
- **Style:** shadcn Input — borde 1 px, fondo card, radio md.
- **Focus:** anillo `--ring` visible; label siempre visible (el placeholder no es label).
- **Error / Disabled:** error debajo del campo con `aria-describedby` + `aria-invalid`; `autocomplete` correcto en contraseñas.

### Navigation
- **Dashboard:** `app-sidebar` shadcn (sidebar zinc, item activo con acento primario); header sticky en landing con anclas (`scroll-margin-top` ≥5rem verificado).
- **Mobile:** breakpoints reales 375/768/1024/1440, cero scroll horizontal a 375, áreas táctiles ≥44×44 px.

### Estados de pantalla (signature del dashboard)
Los cuatro estados son entregables: **loading** (skeleton con la forma y altura reales del contenido — cero layout shift, nunca spinner centrado), **empty** (`EmptyState` con CTA), **error** (`error.tsx` / `SectionError` con reintento), **éxito** (toast con verbo en pasado).

### Motion (aplicado por componente)
- Landing: easing `cubic-bezier(0.4, 0, 0.2, 1)`, duraciones 150/300/500 ms, entrada única `BlurFade` (16–20 px + opacidad, `once`), stagger 80 ms con presupuesto <500 ms/sección. Un solo loop en toda la app: los `AnimatedBeam` del hero.
- Dashboard: easing `cubic-bezier(0.2, 0, 0, 1)`, 150/200/300 ms, **sin animaciones de entrada por scroll**; motion solo como feedback.
- Nunca `transition: all`; solo `transform`/`opacity`. Reduced motion: contenido íntegro, mismo layout, cero animación.

## 6. Do's and Don'ts

### Do:
- **Do** componer toda cifra de dinero/métrica en Geist Mono con `tabular-nums`.
- **Do** alternar cream → navy → cream en la landing; hero y CTA final en navy.
- **Do** entregar los cuatro estados (loading/empty/error/éxito) en cada pantalla de dashboard.
- **Do** verificar contraste AA con números, no a ojo (cream/navy ≈ 15.2:1 ✓, gold/navy ≈ 7.6:1 ✓).
- **Do** usar cifras de mercado con fuente visible (35 M hogares, CONAPO 2025) — nunca tracción propia inventada.
- **Do** respetar `prefers-reduced-motion` sin pérdida de contenido ni de layout.

### Don't:
- **Don't** cruzar la frontera D7: `--brand-*` fuera de `(public)/` está prohibido, igual que reescribir zinc para la landing.
- **Don't** reproducir "el default reconocible de diseño IA": titular Geist sobre cream con acento gold, hero-metric template, card grids idénticos.
- **Don't** usar gold como texto sobre cream (≈1.9:1), como fondo amplio ni como icono decorativo.
- **Don't** usar gradientes de color ajenos al sistema ni `background-clip: text`.
- **Don't** animar con rebote o overshoot: "un producto que custodia dinero ajeno no rebota".
- **Don't** usar `transition: all`, ni animar `width`/`height`/`top`/`left`.
- **Don't** hardcodear strings: es/en al 100 %, el inglés como traducción real, no calco.
- **Don't** usar color como único portador de información (estados, plan recomendado, errores).
