# HOME360 — instrucciones para Claude Code

La guía completa del proyecto (estructura, stack, convenciones roger-arq, frontera D7,
comandos de verificación) vive en AGENTS.md y es la fuente única de verdad:

@AGENTS.md

Recordatorios específicos para Claude Code:

- Antes de tocar UI, lee `PRODUCT.md` y `DESIGN.md`; el normativo de ejecución visual es
  `spec/DESIGN-DIRECTIVE.md`.
- La unidad de trabajo son los tickets de `spec/tickets/`; verifica siempre con
  `pnpm typecheck`, `pnpm check` y `pnpm build` (no hay tests automatizados).
- No cruces la frontera D7: un solo sistema ink/zinc (sin `--brand-*` ni Fraunces);
  mesh hero, beams y entradas por scroll solo en `src/app/[locale]/(public)/`.
