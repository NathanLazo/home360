# [XC-11] Completar la máquina de estados de Dispute (OPEN → IN_REVIEW)

> Ticket transversal (pre-F0/F5). Nace del hallazgo XC-11 de `spec/tickets/XC-findings.md`.

## Metadatos

- **Fase**: XC — corrección transversal de specs (aplicar antes de ejecutar F5)
- **Spec origen**: `spec/00-foundations.md` §3 (`DisputeStatus`, `DisputeResolution`) ·
  `spec/05-admin.md` §3
- **Depende de**: —
- **Tamaño estimado**: S

## Contexto

Las disputas nacen `OPEN` (default de F0) y F5 §3 dice que `MORE_EVIDENCE` deja la
disputa "permanece IN_REVIEW", pero ninguna spec define quién transiciona `OPEN →
IN_REVIEW`. Además `admin.disputes.list` filtra por `status?: "open"|"resolved"` (2
valores contra un enum de 3) sin mapeo escrito, y el listado pinta "En revisión ámbar"
sin regla que separe urgencia de estado. Resolución elegida: `MORE_EVIDENCE` es la única
transición a `IN_REVIEW` y el filtro `"open"` agrupa `OPEN|IN_REVIEW`.

## Alcance

- `spec/05-admin.md` §3: tabla de resoluciones, filtro de `list`, reglas visuales.
- `spec/00-foundations.md` §3: comentario de una línea en `DisputeStatus` (opcional).
- Fuera de alcance: código; creación de disputas (nacen en la app móvil/seed).

## Detalle técnico

En `spec/05-admin.md` §3, sustituir la fila `MORE_EVIDENCE` y añadir reglas:

```text
| MORE_EVIDENCE | sin movimiento | status OPEN|IN_REVIEW → IN_REVIEW; NO escribe
  Dispute.resolution ni resolvedAt (solo las 3 resoluciones monetarias los persisten) |
```

Reglas normativas a añadir tras la tabla:

- `resolve` acepta disputas en `OPEN` o `IN_REVIEW`; `RESOLVED` → `CONFLICT` (ya
  especificado).
- Filtro de `list`: `"open"` ⇒ `status IN (OPEN, IN_REVIEW)`; `"resolved"` ⇒ `RESOLVED`.
  `openCount` cuenta `OPEN + IN_REVIEW` (mismo criterio que el badge del sidebar admin,
  F5 encabezado).
- Regla visual de `dispute-list-item.tsx`: rojo si `urgency = URGENT` y estado no
  resuelto; ámbar si `status = IN_REVIEW` (y no URGENT); gris si `RESOLVED`; neutro para
  `OPEN` NORMAL.

En `spec/00-foundations.md` §3, comentario:
`enum DisputeStatus { OPEN IN_REVIEW RESOLVED } // IN_REVIEW solo vía resolución MORE_EVIDENCE`.

Invariante a verificar a mano en F5: "MORE_EVIDENCE deja `resolution` y `resolvedAt` en
null y status IN_REVIEW; un segundo `resolve` monetario sobre IN_REVIEW procede".

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Contrato `TrpcResponse<TResult, TError>`; errores como códigos estables.
- Resolución de disputas transaccional e idempotente (criterio existente de F5).
- TypeScript estricto, sin `any`; el mapa estado→variante del badge tipado por unión
  exhaustiva.
- Sin comandos de BD para agentes; cualquier migración o dato la ejecuta Roger.

## Criterios de aceptación

- [ ] F5 §3 define todas las transiciones alcanzables desde `OPEN` e `IN_REVIEW`.
- [ ] El mapeo del filtro `"open"|"resolved"` al enum de 3 valores está escrito.
- [ ] `MORE_EVIDENCE` explícitamente no persiste `resolution`/`resolvedAt`.

## Comandos para Roger (si aplica)

—
