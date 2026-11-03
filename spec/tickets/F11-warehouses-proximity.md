# [F11] Almacenes y recomendación de productos por cercanía

Origen: petición del owner (2026-11-03). Las empresas con varias ubicaciones guardan stock en almacenes; la app
recomienda productos según la ubicación con stock más cercana al cliente. Afecta a `home360` (schema, API, dashboard) y
a `home360-app` (ticket hermano `M9`).

## Decisiones (D11-x, normativas)

| # | Decisión |
|---|---|
| D11-1 | **Almacén = tipo de ubicación**, no un modelo nuevo: `Branch.kind: BranchKind { STORE, WAREHOUSE }` (default `STORE`). Reutiliza `ProductStock`, `StockMovement`, geo y D10-6 sin migrar datos. |
| D11-2 | `kind` se fija **al crear** (`branch.create`); `branch.update` no lo acepta. Evita estados inválidos (workers en un almacén). |
| D11-3 | Un almacén **solo guarda stock**: nunca es origen del radar (`resolveRadarBranch`, `isRequestVisibleToBusiness`), no cuenta para `notifyNearbyBusinesses`, no admite workers (`assertBranchBelongsToBusiness` exige `STORE`) y no cuenta para la distancia de `listBusinesses({ kind: "service" })`. |
| D11-4 | **Pickup configurable por almacén**: se respetan `pickupEnabled`/`deliveryEnabled`. Un almacén nuevo nace solo-envío (`pickupEnabled = false`) salvo que se active. Sin pickup su dirección no se publica y sus coordenadas salen aproximadas (F10 L5). |
| D11-5 | **Proximidad de producto** = km a la ubicación ACTIVE (tienda o almacén) más cercana con `stock > 0` y envío o recolección activos (`nearestStockKm`). Origen = punto explícito `lat/lng` o la dirección predeterminada (`resolveMarketplaceOrigin`). |
| D11-6 | **Recomendaciones** (`marketplace.listFeaturedProducts`): solo productos con stock vendible; pool de 100 ordenado por rating del negocio y recencia, re-rankeado por distancia (nulls al final; el orden del pool rompe empates) y cortado a 10. Sin origen, el orden es el del pool. |
| D11-7 | **Búsqueda** (`marketplace.search`): mantiene su orden y cursor; cada producto lleva `distanceKm` (servicios: `null`). |

## Delta de schema (Prisma)

```prisma
enum BranchKind { STORE WAREHOUSE }
model Branch { kind BranchKind @default(STORE) }
```

Aplicar con `pnpm db:push` (las filas existentes quedan `STORE`).

## Procedures

| Router | Procedure | Cambio |
|---|---|---|
| branch | `create` | + `kind?: "STORE" \| "WAREHOUSE"` |
| branch | `list` | items + `kind` |
| marketplace | `listFeaturedProducts` | input opcional `{ lat?, lng? }`; items + `distanceKm: number \| null`; orden por cercanía |
| marketplace | `search` | + `lat?`, `lng?`; items + `distanceKm` |
| marketplace | `getBusiness` | `branches[]` + `kind` |

## Dashboard (W8 Sucursales)

- Formulario: selector "Sucursal / Almacén" (radios nativos, bloqueado al editar). En almacén se oculta el radio de
  cobertura y la sección pasa a "Ubicación".
- Tarjeta: badge "Almacén"; sin fila de cobertura; sin coordenadas → "No se recomendará por cercanía".
- Equipo (W6): el selector de sucursal del worker solo lista `STORE`.

## Pendientes

- **Escala**: el ranking es Haversine en memoria sobre un pool acotado. Cuando haya varias ciudades o un catálogo grande,
  pasar a prefiltro por bounding box en SQL o PostGIS (`ST_DWithin` + índice GiST).
- **Alcance de envío**: hoy un almacén surte DELIVERY sin límite de distancia (igual que D10-6). Definir un radio de
  entrega por ubicación si hace falta.
