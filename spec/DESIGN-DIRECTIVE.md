# Directivo de diseño — HOME360

Documento **normativo de ejecución visual** para F6 y posteriores. No sustituye a los
tickets: los tickets dicen *qué* se construye, este documento dice *cómo se ve y cómo se
mueve*. Ante contradicción sobre alcance manda el ticket; sobre estética y motion manda
este archivo. `spec/08-business-model-alignment.md` D7 (frontera marca/zinc) sigue siendo
inviolable.

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

## 1. Frontera D7 (no negociable)

| Superficie | Paleta | Personalidad |
|---|---|---|
| `src/app/[locale]/(public)/**` (landing W1) | `--brand-*` | Premium |
| `dashboard/**`, `admin/**`, auth | zinc shadcn | Corporate |

Los tokens `--brand-navy/gold/cream/gray` **no aparecen** fuera de `(public)/`. Los tokens
zinc no se reescriben para complacer a la landing. Cualquier agente que necesite cruzar esa
frontera está mal encaminado: reporta y detente.

---

## 2. Tipografía: el único lugar donde tomamos un riesgo

Hoy el proyecto corre con Geist Sans + Geist Mono y `--font-heading: var(--font-sans)`. Un
titular Geist sobre fondo cream con acento gold es exactamente el default reconocible de
diseño generado por IA. La paleta está fijada por marca y no se toca; **el riesgo se gasta
íntegro en la cara de display**, y en ningún otro lado.

**Instrucción (la ejecuta el agente dueño de la ola 2 de landing):**

- Añadir **una** cara de display vía `next/font/google` en `src/app/[locale]/layout.tsx`,
  expuesta como `--font-display`, y declarar `--font-display` en el bloque `@theme` de
  `src/styles/globals.css`.
- Cara elegida: **Fraunces** (variable, ejes `opsz` y `SOFT`), pesos 600–700, `opsz` alto.
  Justificación: es una serif contemporánea con corte de herramienta —terminaciones
  angulosas, contraste alto— que evoca oficio y permanencia sin caer en la serif editorial
  neutra del default. Su eje óptico permite titulares apretados sin volverse decorativa.
  Alternativa aceptable si Fraunces no carga: **Instrument Serif** (una sola cara, más
  seca). No se usa una tercera opción sin justificarlo en el reporte.
- **Alcance de uso**: `--font-display` se aplica **solo** a `h1` y `h2` dentro de
  `(public)/`. Nunca en dashboard/admin, nunca en body, nunca en botones, nunca en `h3`.
  Se aplica con una clase local del módulo, no cambiando `--font-heading` global.
- Geist Sans sigue siendo el cuerpo. **Geist Mono** es la cara de utilidad y carga
  significado: números de paso, cifras de métricas, precios y etiquetas de dato. Mono =
  "esto es un dato verificable", coherente con un producto de custodia de dinero.

**Escala de tipo de la landing** (base 16 px, `text-balance` en titulares,
`text-pretty` en párrafos, medida de 60–75 caracteres en cuerpo):

| Rol | Tamaño | Cara | Peso | Tracking |
|---|---|---|---|---|
| `h1` hero | `clamp(2.5rem, 6vw, 4.5rem)` | display | 700 | `-0.02em` |
| `h2` sección | `clamp(1.875rem, 3.5vw, 2.75rem)` | display | 600 | `-0.015em` |
| `h3` card/paso | `1.125rem` | sans | 600 | `-0.01em` |
| Cuerpo | `1rem` / `1.0625rem` | sans | 400 | `0` |
| Eyebrow / label | `0.75rem` | mono | 500 | `0.08em`, uppercase |
| Cifra métrica | `clamp(2rem, 4vw, 3rem)` | mono | 600 | `-0.02em`, `tabular-nums` |

Reglas duras: jerarquía sin saltos (h1 → h2 → h3); `tabular-nums` en toda cifra que anime o
cambie; comillas y guiones tipográficos correctos en el copy es/en (« » no aplica en
español mexicano: usa comillas dobles curvas “ ”; guion largo — para incisos, no `-`).

---

## 3. Color: cómo se usa, no solo cuál es

Los cuatro tokens no son un tema completo. Reglas de aplicación:

- **Ritmo de secciones**: alterna cream → navy → cream. El hero y el CTA final son navy
  (los dos momentos de mayor peso); features, how-it-works y pricing son cream. Métricas
  puede ser navy si el ritmo lo pide, nunca dos navy consecutivos.
- **Gold es escaso y significa acción o custodia.** Se permite en: el CTA primario, el
  subrayado del wordmark, el borde del badge del hero, el BorderBeam en hover, el acento
  del plan recomendado. Prohibido: fondos gold amplios, texto de párrafo gold, iconos gold
  por decoración. Si en una pantalla hay más de ~4 apariciones de gold, sobra una.
- **`--brand-gray` es texto secundario sobre navy**, no un quinto acento.
- **Contraste (WCAG AA, verificado, no asumido)**: `#f5f0e8` sobre `#0d1b2a` ≈ 15.2:1 ✓.
  `#c8a96e` sobre `#0d1b2a` ≈ 7.6:1 ✓. **`#c8a96e` sobre `#f5f0e8` ≈ 1.9:1 ✗** — gold sobre
  cream **no se usa nunca para texto ni para iconografía portadora de significado**; solo
  para bordes y filetes decorativos de ≥2 px acompañados de otro indicador. El texto del CTA
  gold es navy, no blanco.
- Nunca uses color como único portador de información (estado de invitación, plan
  recomendado, error): siempre color + texto o icono.

---

## 4. Movimiento

**Personalidad: Premium** en la landing. Es un producto que custodia el dinero de otra
persona; un rebote elástico comunica lo contrario de lo que vendemos.

- Easing firma: `cubic-bezier(0.4, 0, 0.2, 1)`. Entradas decelerando (`ease-out`), salidas
  acelerando (`ease-in`). **Overshoot 0 %** en toda la landing. Nada de `ease-out-back`.
- Paleta de duraciones: **rápida 150 ms** (hover, foco, press), **estándar 300 ms**
  (entrada de card, cambio de estado), **lenta 500 ms** (revelado de sección, hero).
- Patrón de entrada único: `BlurFade` desde 16–20 px abajo + opacidad, `inView`, **una sola
  vez** (`once`). Nada re-anima al volver a hacer scroll.
- **Stagger**: 80 ms entre hermanos, presupuesto total **< 500 ms por sección**. Con 3+
  elementos, no más de 1/3 en movimiento simultáneo.
- **Un solo loop en toda la aplicación**: los `AnimatedBeam` del hero. El `ShimmerButton`
  aparece **una vez** en todo el producto (CTA primario del hero). `BorderBeam` solo en
  hover de feature card. Si aparece un segundo loop ambiental, está de más.
- Coreografía del hero (secuencia, no efectos sueltos): badge (0 ms) → titular `TextAnimate`
  por palabra (80 ms) → subtítulo (240 ms) → fila de CTAs (320 ms) → visual con beams
  (400 ms). Total bajo 900 ms; el LCP no espera a la animación.
- Micro-interacciones obligatorias, todas ≤150 ms: hover de CTA (elevación de sombra +
  1–2 % de escala máximo), press (`active:scale-[0.98]`), foco visible en **todo** elemento
  interactivo, hover de fila de tabla, hover de card (sombra + borde, no traslación).
- Nunca `transition: all`. Anima `transform` y `opacity`; jamás `width`, `height`, `top` ni
  `left`. Sin `linear` para movimiento espacial.

**Reduced motion es un requisito de entrega, no un extra.** Bajo
`prefers-reduced-motion: reduce`: sin `BlurFade`, sin `TextAnimate`, sin beams, sin
shimmer, sin `BorderBeam`, sin `scroll-behavior: smooth`, y `NumberTicker` muestra la cifra
final directamente. El contenido queda **íntegro y en el mismo layout** — nunca se pierde
información ni se mueve nada de sitio. Verificable con el emulador de DevTools.

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

- Zinc shadcn, easing `cubic-bezier(0.2, 0, 0, 1)`, duraciones 150/200/300 ms, overshoot 0.
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
- [ ] Frontera D7 intacta.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm build` en verde.
