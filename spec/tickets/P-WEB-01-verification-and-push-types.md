# [P-WEB-01] Recuperar verificación verde y cerrar Expo Push

## Evidencia actual

`pnpm typecheck` falla en `src/server/services/push/expo-push.ts`: resolución de
`expo-server-sdk`, parámetros implícitamente `any` y normalización de receipts `unknown`.
La dependencia sí figura en `package.json`, `pnpm-lock.yaml` y el virtual store.

## Trabajo pendiente

- Diagnosticar por qué TypeScript no resuelve `expo-server-sdk` desde el install actual.
- Tipar tickets y receipts con los tipos públicos del SDK, sin `any` ni casts amplios.
- Verificar limpieza de tokens `DeviceNotRegistered`, chunks y errores parciales.
- Ejecutar `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Registrar cualquier error ajeno al push como ticket nuevo; no declarar el repo cerrado
  mientras alguno de esos tres comandos falle.

## Aceptación

- Los tres comandos terminan en verde desde un checkout limpio.
- Un fallo parcial de Expo no pierde los tickets exitosos ni expone tokens en logs.

