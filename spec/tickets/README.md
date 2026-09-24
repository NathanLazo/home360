# Pendientes de implementación — HOME360 web/API

Esta carpeta contiene únicamente trabajo pendiente verificado contra el código de
`home360` y contra el consumidor móvil `home360-app` el 2026-09-01. Las specs
`spec/00-foundations.md` … `spec/10-mobile-app.md` permanecen como contrato de producto;
ya no funcionan como backlog.

## Estado auditado

- Las fases F0–F7 y los tickets XC están materializados en el código actual.
- La verificación no está cerrada: `pnpm typecheck` falla en
  `src/server/services/push/expo-push.ts` aunque `expo-server-sdk` está declarado.
- No se ejecutaron migraciones, seed, Stripe CLI, builds ni recorridos E2E durante esta
  auditoría.
- El cliente móvil reveló contratos aditivos que no estaban cubiertos por el backlog web.

## Orden activo

1. [`P-WEB-01-verification-and-push-types.md`](P-WEB-01-verification-and-push-types.md)
2. [`P-WEB-02-mobile-api-gaps.md`](P-WEB-02-mobile-api-gaps.md)
3. [`P-WEB-03-production-decisions.md`](P-WEB-03-production-decisions.md)
4. [`P-WEB-04-operational-rollout.md`](P-WEB-04-operational-rollout.md)
5. [`P-WEB-05-released-payment-refunds.md`](P-WEB-05-released-payment-refunds.md)
6. [`F8-01-ai-assistant.md`](F8-01-ai-assistant.md) — asistente IA por panel (implementado; falta `db:push` y `build`)

`P-WEB-01` y `P-WEB-02` bloquean el cierre de la app móvil. `P-WEB-03` debe cerrarse
antes de producción. `P-WEB-04` lo ejecuta Roger. `P-WEB-05` es una capacidad posterior y
no bloquea el lanzamiento inicial.
