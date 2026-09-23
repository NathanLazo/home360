# Product

## Register

product

> Excepción por superficie: `src/app/[locale]/(public)/**` (landing W1) opera en registro **brand** con mayor intensidad (display grande, mesh gradient solo en el hero, beams, CTAs pill), pero **sobre el mismo sistema ink/zinc** que la herramienta. Por decisión del product owner la paleta navy/gold/cream/gray está retirada (Fraunces queda como acento editorial de la landing); D7 se reinterpreta en `DESIGN.md` §10.

## Users

- **Dueños de negocios de servicios** (plomería, electricidad, limpieza) en México — el visitante de la landing. Su trabajo: decidir si registra su operación en la plataforma. Contexto: desconfianza ganada de un mercado 95 % informal; necesita ver custodia y evidencia, no marketing.
- **Operadores de negocio** en `/dashboard`: gestionan órdenes, cotizaciones, wallet (disponible / escrow / bonos), equipo de trabajadores y sucursales. Están en flujo de trabajo, no de descubrimiento.
- **Admins de plataforma** en `/admin`: verificación documental, disputas (donde la grabación ininterrumpida del servicio es la prueba reina), settings de plataforma.
- **Cuentas corporativas consumidoras** (F7, `/corporate`): restaurantes, hoteles y cadenas con sucursales que consumen servicios bajo membresía.
- Clientes finales usan la app móvil (proyecto aparte, `spec/10-mobile-app.md`); en la web solo tocan `/pay`.

## Product Purpose

HOME360 es un marketplace de mantenimiento del hogar donde el dinero del cliente queda retenido en escrow hasta que el trabajo se entrega con evidencia grabada. Lanzamiento en Chihuahua (934 000 hogares, 500+ proveedores listos), expansión norte y luego nacional. La web es el plano de operación y administración; su landing tiene un solo trabajo: que el dueño de un negocio se registre. Éxito = registros de negocios y operación confiable de órdenes/disputas, no vanity metrics.

## Brand Personality

Dos personalidades bajo una misma disciplina:

- **Landing (Premium)**: oficio, permanencia, dinero custodiado. Sistema Vercel-inspired (ink, hairlines, Geist en todo, Geist Mono como cara de "dato verificable"), primary de **metal líquido** y **Liquid Glass** como firma; mesh gradient solo como atmósfera del hero. Motion decelerado (`cubic-bezier(0.22, 1, 0.36, 1)`), overshoot 0.
- **Dashboard/admin/corporate (Corporate)**: herramienta que "está", no que se revela. Mismos tokens ink/zinc, metal vivo solo en la acción decisiva, movimiento solo como feedback.

Voz (es/en): directa, concreta, sentence case. Sin exclamaciones, sin "revoluciona", sin "potencia tu negocio". Tres palabras: **custodiado, verificable, de oficio**.

## Anti-references

- El default reconocible de diseño IA: hero-metric template, card grids idénticos, gradientes miniaturizados en chips y botones.
- SaaS genérico de "productividad": todo elemento decorativo que no diga algo verdadero sobre custodia, oficio o confianza, se elimina.
- Gradientes de color ajenos al sistema; el mesh gradient fuera del hero de la landing; metal o glass como decoración (más de 2 metales vivos o más de una firma glass + metal por pantalla, sobra).
- Métricas de tracción inventadas: las cifras son de mercado (35 M hogares, ~$350 000 M MXN, CONAPO 2025) con fuente visible (D8).
- Motion elástico o con rebote: un producto que custodia dinero ajeno no rebota.

## Design Principles

1. **La custodia se muestra, no se declara** — evidencia, comprobante, entrega verificada como vocabulario visual; mono para todo dato verificable.
2. **Un sistema, dos intensidades** — landing y herramienta comparten tokens (D7 reinterpretada); lo exclusivo de la landing (mesh, beams, entradas por scroll) no cruza a la herramienta.
3. **La herramienta está, no se revela** — cero animación ambiental en dashboard/admin; motion solo como feedback ≤300 ms.
4. **Los cuatro estados son entregables** — loading (skeleton con forma real), empty (CTA), error (reintento), éxito (verbo en pasado) en cada pantalla.
5. **Dos idiomas o ninguno** — es/en al 100 %, cero strings hardcodeados; el inglés es traducción real, no calco.

## Accessibility & Inclusion

- WCAG AA verificado, no asumido (`mute` #888 ≈ 3.4:1 — nunca copy esencial de cuerpo; texto link en `link-deep`).
- `prefers-reduced-transparency` / `prefers-contrast: more`: las superficies glass se vuelven sólidas.
- Color nunca es el único portador de información.
- `prefers-reduced-motion` es requisito de entrega: contenido íntegro y mismo layout sin animación.
- Teclado completo, foco visible en todo interactivo, áreas táctiles ≥44×44 px.
- Detalle normativo de ejecución en `spec/DESIGN-DIRECTIVE.md` §8 (checklist de entrega).
