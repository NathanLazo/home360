# [F12] Categorías fijas y multi-categoría por servicio

Origen: bug del owner (2026-11-03): las solicitudes no llegaban a los negocios. `ServiceRequest.category` es canónica
(`REQUEST_CATEGORIES`) y `Service.category` era texto libre; el radar y las notificaciones comparaban por igualdad.
Afecta a `home360` y a `home360-app` (espejo de la taxonomía).

## Decisiones (D12-x, normativas)

| #     | Decisión                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D12-1 | **Taxonomía fija** de 33 categorías en `src/schemas/marketplace/request-categories.ts`. Los valores son claves de datos (nunca se renombran ni se borran); `REQUEST_CATEGORY_MESSAGE_KEYS` las mapea a claves i18n ASCII (`common.serviceCategory.*`).                                     |
| D12-2 | **Un servicio declara 1–8 categorías** (`Service.categories String[]`). `Service.category` queda como primaria (= `categories[0]`) para listados y lecturas legadas.                                                                                                                       |
| D12-3 | **Match del radar** (`listBusinessCategories`, `isRequestVisibleOnRadar`, `notifyNearbyBusinesses`): la categoría de la solicitud ∈ `categories`. Filas legadas (`categories` vacío) se mapean con `toRequestCategory` (acentos, mayúsculas y sinónimos), así que no se requiere backfill. |
| D12-4 | **Importación de hojas**: la celda de categoría acepta varias separadas por `, ; /                                                                                                                                                                                                         | `; cualquier valor fuera de la taxonomía invalida la fila (`SERVICE_INVALID_CATEGORY`). |
| D12-5 | **Dashboard**: selector múltiple con búsqueda (chips removibles, la primera es la principal); filtros y tabla muestran etiquetas traducidas.                                                                                                                                               |
| D12-6 | **Agente/MCP**: `createService`/`updateService` reciben `categories`; las listas de categorías del prompt salen de `REQUEST_CATEGORIES`.                                                                                                                                                   |

## Delta de schema (Prisma)

```prisma
model Service { categories String[] @default([]) }
```

Aplicar con `pnpm db:push` (aditivo: las filas existentes quedan con `categories = []` y siguen funcionando por D12-3).

## Verificación

`pnpm typecheck`, `pnpm check`, `pnpm build`. Manual: crear un servicio con 2+ categorías, publicar una solicitud de la
segunda categoría dentro del radio y confirmar que aparece en Solicitudes y llega la notificación.
