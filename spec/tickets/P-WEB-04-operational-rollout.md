# [P-WEB-04] Ejecutar rollout y verificación E2E

Este ticket es operativo y lo ejecuta Roger; el agente no corre comandos de base de datos,
Stripe CLI ni despliegues.

## Pendiente

- Aplicar el schema actual con el flujo aprobado del proyecto (`pnpm db:push`) y cargar el
  seed idempotente en un entorno no productivo.
- Configurar Stripe, Pusher, Vercel Blob, AI Gateway, correo/SMS, cron y Expo Push.
  Crons (ambos con `Authorization: Bearer CRON_SECRET`): `/api/cron/release-escrow` y
  `/api/cron/rating-reminders` (cada hora); ver `spec/03-payments.md` §5.
- Probar webhooks con firma real e idempotencia; confirmar reintentos.
- Ejecutar los recorridos manuales: auth, negocio, admin, corporativo, pago/escrow/refund,
  suscripción, chat/tracking, worker y push.
- Validar backup/rollback, observabilidad, alertas y rotación de secretos antes de producción.

## Aceptación

- Existe evidencia por recorrido y no quedan errores silenciosos/no-op por env faltante.
- Los eventos monetarios reconciliados coinciden entre Stripe y el ledger local.

