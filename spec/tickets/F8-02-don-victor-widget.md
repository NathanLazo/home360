# [F8-02] Don Víctor — widget pixel-art del asistente

## Metadatos

- **Fase:** F8 — Asistente operativo
- **Spec origen:** personalidad del concierge (`design/` Don Víctor) + estados del orbe de F8-01
- **Depende de:** F8-01 (`agent-chat`, `agent-orb-state`)
- **Tamaño:** M
- **Estado:** implementado el 2026-09-24

## Contexto

El asistente ya deriva un estado de actividad (`deriveAgentOrbState`) que mueve el
orbe `thinking-orbs` del botón de enviar. Don Víctor, el concierge de la marca,
encarna ese mismo estado como sprite 2D pixel-art: un widget flotante sobre el chat,
arrastrable dentro del contenedor y magnético a sus bordes. Solo el sprite, sin card ni
texto (decisión del owner): el estado lo anuncia el composer.

## Alcance

Módulo `src/components/agent/don-victor/` (sin dependencias nuevas):

| Archivo                      | Responsabilidad                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `don-victor-palette.ts`      | Paleta de ilustración (polo = ink del sistema; azul `link` solo para señales)                                                           |
| `don-victor-sprites.ts`      | `grid()` validado, `BODY` 40×40, geometría de ojos, props y fx como capas ASCII                                                         |
| `don-victor-choreography.ts` | `CHOREOGRAPHY[state]`: fps (2–6), frames (capas, pupila, bob), parpadeo                                                                 |
| `don-victor-renderer.ts`     | `composeFrame()` puro → RGBA 40×40                                                                                                      |
| `use-don-victor-animator.ts` | rAF; repinta solo al cambiar frame o parpadeo; offscreen 1:1 → escala entera sin suavizado                                              |
| `don-victor-sprite.tsx`      | `<canvas aria-hidden>` con `image-rendering: pixelated`                                                                                 |
| `don-victor-position.ts`     | `{side, top}` en `localStorage` (`home360.agent.victor.position`)                                                                       |
| `use-magnetic-drag.ts`       | Drag libre; límites = contenedor − composer − gap (ResizeObserver); snap al lado más cercano con `SPRING_LAYOUT`; imán vertical a 32 px |
| `don-victor-widget.tsx`      | `motion.div` arrastrable con el sprite a 80 px; `useMediaQuery(min-width: 768px)`; solo en `variant="page"`                             |

Integración en `agent-chat.tsx`: `boundsRef` (contenedor relativo del chat) y
`composerRef` (área reservada); `inputOrbState` se pasa tal cual.

## Mapa estado → pose

| Estado       | Pose                                | Fx                        | fps |
| ------------ | ----------------------------------- | ------------------------- | --- |
| `breathing`  | reposo, bob de 1 px, parpadeo       | —                         | 2   |
| `listening`  | mano a la oreja, mirada al composer | ondas de sonido           | 3   |
| `connecting` | teléfono a la oreja                 | arcos de señal crecientes | 4   |
| `searching`  | lupa en alto, mirada barriendo      | —                         | 3   |
| `working`    | llave inglesa, brazo sube y baja    | destello                  | 5   |
| `solving`    | mano en la barbilla, mirada arriba  | puntos de pensamiento     | 2   |
| `composing`  | pluma sobre el pecho, mano oscila   | —                         | 6   |

## Reglas

- **Desktop only**: bajo `md` no se monta (nada que ocultar con CSS, cero coste).
- **Nunca sobre el composer**: la altura del composer se resta del área de arrastre.
- **Magnético**: al soltar, desliza al lado izquierdo o derecho más cercano; si queda
  a menos de 32 px del borde superior, también se pega a él. A menos de 32 px del borde
  superior del composer se acopla a ese borde conservando su offset horizontal (posición
  persistida como `{side: "composer", left}`).
- **Reduced motion**: frame 0 estático, sin parpadeo, snap instantáneo, sin escala.
- **Accesibilidad**: `aria-hidden` en todo el widget; el estado lo anuncia el composer.
- **D7**: personalidad Corporate; sin mesh, beams ni metal/glass; único acento de color
  = azul `link` en las señales (un color, un significado).
- Cero strings: el widget no tiene copy.

## Verificación

- `pnpm typecheck`, `pnpm check`, `pnpm build` en verde.
- Manual en `/es/dashboard/assistant`: arrastrar a las cuatro esquinas, redimensionar,
  teclear, enviar, recargar (posición persistida), viewport < 768 px, emulación de
  `prefers-reduced-motion`.
