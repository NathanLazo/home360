# Directivo de diseño — HOME360

Documento **normativo de ejecución visual** para F6 y posteriores. No sustituye a los
tickets: los tickets dicen *qué* se construye, este documento dice *cómo se ve y cómo se
mueve*. Ante contradicción sobre alcance manda el ticket; sobre estética y motion manda
este archivo. El sistema visual (tokens, primitivas, budgets) está en `DESIGN.md`.

> **Actualización (sistema "Vercel-inspired" + metal líquido + Liquid Glass).** Por
> decisión del product owner la paleta de marca navy/gold/cream/gray queda
> **retirada** (Fraunces sobrevive solo como acento editorial de la landing): toda la plataforma, landing incluida, usa el sistema ink/zinc de
> `DESIGN.md`. D7 se reinterpreta en §1.

Fuentes: `roger-arq` (arquitectura), `frontend-design` (dirección de arte), `motion-design`
(movimiento), más los barridos de calidad F6-12…F6-16.

---

## 0. El sujeto, antes que la estética

HOME360 no es "una landing SaaS". Es un **marketplace de mantenimiento del hogar en
México** donde el dinero del cliente queda retenido en escrow hasta que el trabajo se
entrega con evidencia grabada. El visitante de W1 no es un consumidor: es **el dueño de un
negocio de servicios** (plomería, electricidad, limpieza) decidiendo si registra su
operación.

La página tiene **un solo trabajo**: que ese dueño se registre.

Consecuencia de dirección de arte: el vocabulario visual sale del mundo del oficio y del
dinero custodiado — evidencia, comprobante, custodia, entrega verificada — no del mundo
genérico de "productividad". Todo elemento decorativo que no diga algo verdadero sobre
custodia, oficio o confianza, se elimina.

---

## 1. Frontera D7 (reinterpretada)

Ya no hay dos paletas. Todas las superficies comparten tokens ink/zinc, Geist, radios,
elevación, metal líquido y Liquid Glass (`DESIGN.md`). Lo que D7 sigue separando es la
**intensidad**:

| Superficie | Exclusivo | Personalidad |
|---|---|---|
| `src/app/[locale]/(public)/**` (landing W1) | `bg-mesh-hero` (solo hero), `text-display-hero`, `LandingBeam`, Magic UI, entradas por scroll, CTAs `size="pill"` | Premium |
| `dashboard/**`, `admin/**`, `corporate/**`, auth | — (sin entradas por scroll, sin mesh, sin beams) | Corporate |

Los tokens `--brand-*` **no existen** en ningún sitio: no se reintroducen. Los tokens
compartidos no se reescriben para una sola superficie; si la landing necesita otra
lectura, se usa una banda `.dark`.

---

## 2. Tipografía

**Una sola familia: Geist.** Sans para todo, Geist Mono para etiquetas técnicas,
eyebrows, código y cifras verificables. Única serif: Fraunces como acento de
headings de la landing (`accentClass`); prohibida en producto. Pesos 400/500/600; 600 es el techo (Tailwind remapea `font-bold` a 600).
Sentence case.

Escala (utilidades de `globals.css`, tracking proporcional ya incluido):

| Rol | Utilidad | Tamaño | Tracking |
|---|---|---|---|
| `h1` hero (landing) | `text-display-hero` | clamp(2.75rem, 6.5vw, 4.5rem) | -0.05em |
| `h1` / título grande | `text-display-xl` | 48/56 | -2.4 px |
| `h2` sección | `text-display-lg` | 32/40 | -1.28 px |
| `h2` herramienta | `text-display-md` | 24/32 | -0.96 px |
| `h3` card/paso | `text-display-sm` | 20/26 | -0.6 px |
| Cuerpo landing | `text-copy` | 16/24 | 0 |
| Cuerpo herramienta | `text-copy-sm` | 14/20 | -0.28 px |
| Eyebrow / dato | `font-mono text-label` | 12/16 | 0 (uppercase opcional) |

El acento de titulares de landing (`*acento*` en el copy) es **mismo Geist**, contraste
por tinta: `font-normal text-mute`. Nunca serif, nunca gradiente en texto.

Reglas duras: jerarquía sin saltos (h1 → h2 → h3); `tabular-nums` en toda cifra que anime o
cambie; comillas y guiones tipográficos correctos en el copy es/en (« » no aplica en
español mexicano: usa comillas dobles curvas “ ”; guion largo — para incisos, no `-`).

---

## 3. Color: cómo se usa, no solo cuál es

- **Lienzo**: página `canvas-soft` (#fafafa), cards/dialogs/inputs `canvas` (#fff),
  inset/hover `canvas-soft-2` (#f5f5f5), bordes `hairline` (#ebebeb).
- **Texto**: `ink` (#171717) por defecto, `body` (#4d4d4d, = `muted-foreground`) para
  secundario, `mute` (#888) solo terciario no esencial o ≥18 px.
- **Primary = metal líquido** (ink + aro de cromo). Una pantalla pide **una** acción; el
  metal vivo (WebGL) se reserva para 1–2 acciones decisivas.
- **Color con significado**: azul `link-*` (link, foco, info), rojo `error-*`, ámbar
  `warning-*` (texto en `warning-deep`), verde `success-*` (liberado/pagado). Nada
  decora.
- **Mesh gradient** (develop/preview/ship): solo como fondo atmosférico del hero de
  landing (`bg-mesh-hero`), jamás miniaturizado.
- **Ritmo de la landing**: secciones `canvas-soft`/`canvas` con bandas `.dark` (ink) para
  hero o CTA final si el ritmo lo pide; nunca dos bandas oscuras consecutivas.
- **Contraste (WCAG AA, verificado)**: ink/canvas-soft 17.2:1 ✓, body/canvas-soft 8.1:1 ✓,
  link-deep/canvas-soft 5.5:1 ✓, `#0070f3`/canvas-soft 4.36:1 ✗ (por eso el texto link usa
  `link-deep`), mute/canvas-soft 3.4:1 (solo ≥18 px o no esencial).
- Nunca uses color como único portador de información (estado de invitación, plan
  recomendado, error): siempre color + texto o icono.

---

## 4. Movimiento

**Personalidad: Premium** en la landing, sobria. Un producto que custodia dinero ajeno no
rebota.

- **Easing normativo (ease-out): `cubic-bezier(0.22, 1, 0.36, 1)`** — transitions.dev
  "smooth out". Es el valor de la utilidad `ease-out` de Tailwind en este repo y de
  `MOTION_EASE.smoothOut` / `LANDING_EASE` en JS. Movimiento en pantalla: `ease-in-out`.
  **Overshoot 0 %** salvo micro-éxitos (`MOTION_EASE.bounce`: check, badge), nunca en
  cierres.
- Paleta de duraciones (`MOTION_DURATION_MS`): **150 ms** (hover, foco, press, cierre),
  **250 ms** (apertura de dropdown/modal), **350–400 ms** (paneles), **≤600 ms**
  (revelado de sección en landing).
- Patrón de entrada de landing: `BlurFade` desde 16–20 px abajo + opacidad, `inView`,
  **una sola vez** (`once`). Nada re-anima al volver a hacer scroll.
- **Stagger**: 40–80 ms entre hermanos, presupuesto total **< 500 ms por sección**.
- **Loops ambientales**: el marquee de garantías y los `LandingBeam` (consola del hero,
  plan recomendado, CTA final). Nada más en loop.
- **Metal y glass no se animan por scroll**: el metal vivo reacciona al cursor (solo con
  `bend`), la óptica glass es estática.
- Micro-interacciones ≤150 ms: press (`active:scale-[0.97]`), foco visible en **todo**
  interactivo, hover de fila, hover de card (sombra + borde, no traslación en herramienta).
- Nunca `transition: all`. Anima `transform` y `opacity`; jamás `width`, `height`, `top` ni
  `left`. Sin `linear` para movimiento espacial (solo loops constantes).

**Reduced motion es un requisito de entrega, no un extra.** Bajo
`prefers-reduced-motion: reduce`: sin `BlurFade`, sin `TextAnimate`, sin beams, sin
shimmer, sin metal vivo (queda el aro estático), sin refracción glass, sin
`scroll-behavior: smooth`, y `NumberTicker` muestra la cifra final directamente. Bajo
`prefers-reduced-transparency` / `prefers-contrast: more` el glass se vuelve sólido. El
contenido queda **íntegro y en el mismo layout**. Verificable con el emulador de DevTools.

---

## 5. Layout y estructura

- Contenedor: `max-w-6xl` centrado, padding `px-4 sm:px-6 lg:px-8`. Secciones con ritmo
  vertical `py-20 lg:py-28`; el hero puede ir a `py-24 lg:py-32`.
- Espaciado en múltiplos de 4 px. El agrupamiento se hace con **espacio**, no con líneas:
  la distancia entre un título y su párrafo debe ser claramente menor que entre bloques.
- Anclas con `scroll-margin-top` suficiente para el header sticky (mínimo `5rem`); se
  verifica navegando desde el header, no a ojo.
- Los devices estructurales dicen algo verdadero: how-it-works **sí** es una secuencia →
  `<ol>` numerado legítimo. Features **no** son una secuencia → nada de `01/02/03` ahí.
- Breakpoints reales: 375 (móvil), 768 (tablet), 1024 (desktop), 1440. Nada de scroll
  horizontal a 375. Áreas táctiles ≥44×44 px.
- Full-bleed en fondos de sección (el color va de borde a borde), contenido siempre dentro
  del contenedor.

---

## 6. Copy (es/en)

- Voz: directa, concreta, en sentence case. Sin signos de exclamación, sin "revoluciona",
  sin "potencia tu negocio". Se nombra lo que el usuario controla y reconoce.
- Verbos activos y consistentes de punta a punta: el botón que dice "Registra tu negocio"
  lleva a un flujo que se llama registro y confirma "Negocio registrado".
- Las cifras de métricas son **de mercado, no de tracción propia** (D8) y llevan pie de
  fuente visible. No se insinúa volumen propio que no existe.
- Errores: qué pasó y cómo se arregla, sin disculpas ni vaguedad. Estados vacíos: una
  invitación a actuar, no un mensaje de ánimo.
- El inglés es una traducción real, no un calco: se revisa que no queden literalismos del
  español. Ambos idiomas al 100 %, cero strings hardcodeados.

---

## 7. Dashboard y admin (Corporate)

La misma disciplina, otra personalidad. Aplica a F6-09 y F6-11:

- Sistema ink/zinc de `DESIGN.md`, easing normativo `cubic-bezier(0.22, 1, 0.36, 1)`,
  duraciones 150/250/350 ms, overshoot 0. Glass solo en cromática flotante (barras de
  guardado sticky, toolbars), nunca en tablas ni cards.
- **Sin animaciones de entrada por scroll.** Una herramienta de trabajo no se revela: está.
  El movimiento se limita a feedback: hover de fila, apertura de Sheet/Dialog (300 ms),
  press de botón, y transiciones de estado de carga.
- Los cuatro estados de cada pantalla son entregables, no adornos: **loading** (skeleton con
  la forma real del contenido, nunca un spinner centrado), **empty** (`EmptyState` con CTA),
  **error** (`error.tsx` con acción de reintento), **éxito** (toast con verbo en pasado).
- Formularios: label visible siempre (el placeholder no es un label), error debajo del campo
  con `aria-describedby`, `aria-invalid` en el input, botón de submit con estado pendiente y
  deshabilitado sin cambios. `autocomplete` correcto en contraseñas.
- Tablas: encabezados `<th scope="col">`, columna de acciones con nombre accesible en el
  botón ⋯, acción destructiva en rojo y detrás de `ConfirmDialog`.
- Skeletons con la misma altura que el contenido final: cero layout shift.

---

## 8. Checklist de entrega (aplica a todo ticket de UI de F6)

- [ ] Cero strings hardcodeados; es y en completos.
- [ ] Jerarquía de headings sin saltos; un solo `h1` por página.
- [ ] Foco visible en todo interactivo; navegable entero con teclado; orden de tab lógico.
- [ ] Contraste AA verificado; color nunca es el único portador de información.
- [ ] `prefers-reduced-motion` respetado sin pérdida de contenido ni de layout.
- [ ] Sin `transition: all`; solo `transform`/`opacity` animados.
- [ ] 375 / 768 / 1024 sin desbordes; áreas táctiles ≥44 px.
- [ ] Loading, empty, error y éxito implementados.
- [ ] Frontera D7 intacta (sin `--brand-*`, Fraunces solo en acentos de landing; mesh/beams/entradas solo en landing).
- [ ] Budgets de metal vivo (≤2) y glass + metal (1) respetados; fallbacks de glass verificados.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
