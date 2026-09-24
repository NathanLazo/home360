# [F8-01] Asistente IA por panel (business, corporate, admin)

## Metadatos

- **Fase:** F8 — Asistente operativo
- **Spec origen:** port del agente de Inerpy (`prohats-quality`: `src/server/agent`, `admin/agent`, `components/agents`) adaptado al contrato roger-arq y a la frontera D7
- **Depende de:** F0–F7 materializados; `AI_GATEWAY_API_KEY` (ya usada por `services/ai`)
- **Tamaño:** L
- **Estado:** implementado el 2026-09-23; pendiente `pnpm db:push` y `pnpm build` por Roger

## Contexto

Inerpy expone un agente `ToolLoopAgent` (AI SDK 7) cuyas tools envuelven el caller
tRPC del servidor, de modo que el RBAC vive en las procedures y no en el agente. La UI
es un chat beui (chat-app, message, prompt-input, message-scroller, streaming-response)
con orbe `thinking-orbs`, chips de actividad por tool y conversaciones persistidas como
snapshot `UIMessage[]`. HOME360 replica el mismo patrón, pero con **tres catálogos
cerrados por área** derivados del rol de la sesión, porque aquí conviven tres paneles con
tenants distintos.

## Alcance

### Backend

- `prisma/schema.prisma`: enum `AgentArea` y modelo `AgentConversation` (userId + area +
  title + messages Json) con relación en `User`.
- `src/lib/agent/agent-area.ts`: `AgentArea`, `agentAreaForRole(role)` (BUSINESS →
  business, CORPORATE → corporate, ADMIN → admin; CUSTOMER/WORKER sin acceso) y rutas.
- `src/lib/agent/agent-models.ts`: catálogo de modelos gateway (Sonnet 5 por defecto,
  Haiku 4.5) compartido por cliente y servidor.
- `src/server/agent/`:
  - `tool-runtime.ts`: `runTool` (nunca lanza, sobre `{result,error,status,message}`,
    recorte de payloads a 48k chars con `_truncated`).
  - `tools/business-tools.ts` (56 tools), `tools/corporate-tools.ts` (21),
    `tools/admin-tools.ts` (40): todas delegan en `createCaller`; reutilizan los schemas
    Zod de los routers. **Sin tools de borrado.** Impersonación, settings de plataforma,
    campañas y export CSV quedan fuera a propósito.
  - `tool-catalog.ts`: `createAgentTools(area, caller)`.
  - `agent-instructions.ts`: prompt por área con contexto (usuario, tenant, fecha en
    America/Chihuahua, locale, modo solo lectura); reglas de confirmación para acciones
    `IRREVERSIBLE` / `MONEY MOVEMENT`, montos en centavos MXN, sin borrados.
  - `home360-agent.ts`: `ToolLoopAgent` con `isStepCount(20)`; `AGENT_MODEL` desde env.
  - `agent-session.ts`: guard de sesión (cookie o Bearer) + nombre del tenant.
- `src/app/api/agent/chat/route.ts`: única ruta REST (streaming) —
  `createAgentUIStreamResponse`, metadata de uso en `finish`, 503 sin gateway key.
- `src/server/services/agent/conversations.ts` + `src/server/api/routers/agent.ts`
  (`agent.getArea/listConversations/getConversation/createConversation/updateConversation/deleteConversation`),
  contrato `TrpcResponse`, scope `userId + area` en la query.
- `src/env.js` / `.env.example`: `AGENT_MODEL` opcional; `AI_GATEWAY_API_KEY` documentada.

### UI

- Componentes beui copiados de Inerpy en `src/components/agents/**` y
  `src/components/motion/**` (+ `lib/ease`, `lib/text-shimmer`, `lib/presence-gate`,
  `lib/hooks/*`) con etiquetas parametrizadas por props y colores migrados a tokens
  (`success`, `warning`).
- Módulo compartido `src/components/agent/`: `agent-chat` (useChat + DefaultChatTransport,
  hilo activo en `?thread=`), `agent-message`, `agent-tool-part` (chips), `agent-markdown`,
  `agent-orb-state`, `agent-conversation-menu` (pins por navegador), `agent-attachments`,
  `use-agent-conversations` (tRPC), `agent-chat-skeleton`.
- Páginas delgadas `dashboard/assistant`, `corporate/assistant`, `admin/assistant`
  (page + loading), `h1` sr-only, aviso de solo lectura bajo impersonación y de
  "no configurado" sin gateway key.
- Nav: entrada "Asistente" en los tres sidebars (`SparklesIcon`).
- i18n: namespace `agent` (es/en) con copy por área y nombre de las 117 tools.

### Fuera de alcance (tickets siguientes)

- **F8-02 Servidor MCP HOME360**: reutilizar los catálogos por área detrás de
  `mcp-handler` con `McpToken` (scope READ_ONLY/READ_WRITE) y OAuth PKCE como en Inerpy.
- **F8-03 Visualizaciones de tools**: stat grids y tablas (`tool-viz`) para KPIs,
  saldos y listados; hoy el resultado se muestra como chip + Markdown del modelo.
- **F8-04 Aprobación HITL en UI** (`needsApproval` + `tool-approval` de beui) para las
  acciones de dinero, en lugar de la confirmación por prompt heredada de Inerpy.

## Restricciones no negociables

- Procedures por rol: el agente nunca decide acceso; si tRPC responde FORBIDDEN el
  modelo lo explica y no reintenta. Bajo impersonación toda escritura devuelve
  `IMPERSONATION_READ_ONLY` y las conversaciones no se persisten.
- `TrpcResponse` en el router `agent`; `ServiceResult` en el servicio.
- TypeScript estricto (sin `any`); un cast en `use-agent-conversations` limitado al
  borde del snapshot persistido por este mismo cliente.
- D7: personalidad Corporate (sin mesh/beams/entradas por scroll); el orbe es canvas 2D
  con frame estático bajo `prefers-reduced-motion`; shimmer desactivado con reduced
  motion; sin metal vivo adicional (el botón de envío usa el orbe sobre `bg-primary`).

## Criterios de aceptación

- [x] `pnpm typecheck` y `pnpm check` en verde (3 warnings heredados de beui: `<img>` en
      previews y una dependencia de `useLayoutEffect`).
- [ ] `pnpm db:push` ejecutado por Roger (nueva tabla `AgentConversation`).
- [ ] `pnpm build` en verde (lo corre Roger).
- [ ] Un BUSINESS solo ve tools de negocio; un ADMIN no puede invocar tools de negocio
      (verificar con "cancela la orden X" desde admin → herramienta inexistente).
- [ ] Sin `AI_GATEWAY_API_KEY` la página muestra el aviso y el composer queda deshabilitado.

## Comandos para Roger

```bash
pnpm db:push
```

```bash
pnpm build
```
