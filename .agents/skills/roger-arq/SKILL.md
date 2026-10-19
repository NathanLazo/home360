---
name: roger-arq
description: Aplica la arquitectura personal de Roger para proyectos T3 Stack con Next.js, TypeScript, tRPC, Prisma y pnpm. Úsala automáticamente al crear, modificar, revisar o refactorizar páginas, módulos, componentes, routers tRPC, servicios, esquemas Prisma, validaciones o pruebas dentro de un proyecto T3, incluyendo UI, animación, 3D, IA y video, donde orquesta las skills especializadas (ui-ux-pro-max, impeccable, better-*, Emil Kowalski, GSAP, Motion, Three.js, vgpu, AI SDK, Higgsfield, Vercel/Next.js). Nunca ejecuta `pnpm build` ni migraciones/`pnpm db:push`: esos comandos los corre el usuario.
---

# Roger Arq

Construye proyectos T3 siguiendo estas reglas como contrato arquitectónico. Antes de editar, inspecciona la estructura y las convenciones existentes; adapta rutas e imports sin debilitar estas reglas.

## Reglas críticas (leer primero, no negociables)

1. **No ejecutes `pnpm build`** (ni `next build`, `pnpm run build` o equivalentes). La compilación la corre el usuario. Si crees que hace falta compilar, termina tu cambio y pídele al usuario que ejecute `pnpm build`.
2. **No ejecutes migraciones de Prisma ni `pnpm db:push`.** Solo edita `prisma/schema.prisma` y avisa al usuario para que él ejecute `pnpm db:push`.
3. Estas dos reglas aplican siempre, aunque el cambio parezca pequeño, aunque falle algo y quieras verificarlo, y aunque el usuario lo mencione de paso: la ejecución es suya.

## Prioridades

1. Correctitud y seguridad de datos.
2. Tipado estricto de extremo a extremo.
3. Separación de responsabilidades y principios SOLID.
4. Código del módulo localizado junto a su página.
5. Respuestas tRPC uniformes.
6. Cambios pequeños, verificables y fáciles de mantener.

## Stack y herramientas

- Usa TypeScript estricto.
- Usa pnpm para instalar dependencias y ejecutar scripts.
- Sigue la configuración T3 existente: Next.js, tRPC, Prisma y el sistema de autenticación ya instalado.
- No cambies librerías, arquitectura base ni versiones sin una razón concreta.
- Prefiere Server Components. Añade `"use client"` únicamente cuando haya estado, efectos, eventos o APIs del navegador.
- Reutiliza utilidades y componentes compartidos existentes antes de crear duplicados.

## Arquitectura por módulo

Cada página o módulo mantiene sus detalles internos en una carpeta privada `_components`.

```text
src/app/
└── [segmento]/
    ├── page.tsx
    ├── loading.tsx              # cuando aplique
    ├── error.tsx                # cuando aplique
    └── _components/
        ├── module-view.tsx
        ├── module-form.tsx
        ├── module-list.tsx
        ├── module-item.tsx
        ├── module.schema.ts
        ├── module.types.ts
        ├── module.utils.ts
        └── use-module.ts         # solo si requiere hook cliente
```

Reglas:

- `page.tsx` es un punto de composición delgado; no contiene un módulo completo.
- Coloca en `_components` todos los componentes, hooks, esquemas, tipos y utilidades que pertenecen exclusivamente a esa página o módulo.
- Un archivo tiene una responsabilidad principal.
- Divide componentes cuando mezclen carga de datos, lógica de negocio, formulario y presentación.
- Mantén los componentes específicos dentro del módulo. Eleva algo a una carpeta compartida solo cuando ya tenga reutilización real en varios módulos.
- No importes detalles privados de `_components` desde módulos ajenos.
- Usa nombres descriptivos orientados al dominio; evita `utils.ts`, `helpers.ts` o `component.tsx` genéricos.
- Si un proyecto existente usa literalmente `_componentes`, conserva ese nombre dentro de ese proyecto. En proyectos nuevos usa `_components`.

## Capas y responsabilidades

Mantén este flujo:

```text
Página/Componentes → cliente tRPC → router/procedure → servicio de dominio → Prisma
```

- UI: renderizado, interacción y estado visual.
- Esquema de entrada: validación y normalización con la librería existente, normalmente Zod.
- Router tRPC: autorización, validación, coordinación y adaptación al contrato de respuesta.
- Servicio de dominio: reglas de negocio reutilizables y operaciones compuestas.
- Prisma: persistencia y selección explícita de datos.
- No accedas a Prisma directamente desde componentes.
- No coloques lógica de negocio extensa dentro de procedures ni componentes.
- Usa inyección por parámetros cuando ayude a probar servicios sin acoplarlos a singletons.
- Depende de contratos y tipos, no de detalles de presentación.
- Evita abstracciones prematuras: extrae una abstracción cuando elimina duplicación real o separa responsabilidades.

## Contrato obligatorio de tRPC

Toda procedure retorna siempre estas cuatro propiedades:

```ts
{
  result: data,
  error: errorIfExists,
  status: numericStatus,
  message: returnMessage,
}
```

Usa un contrato genérico estricto:

```ts
export type TrpcResponse<TResult, TError = string> = {
  result: TResult | null;
  error: TError | null;
  status: number;
  message: string;
};
```

Reglas:

- Éxito: `result` contiene los datos y `error` es `null`.
- Error: `result` es `null` y `error` contiene un valor serializable y seguro.
- `status` siempre es un número coherente con el resultado, por ejemplo 200, 201, 400, 401, 403, 404, 409 o 500.
- `message` siempre es clara, breve y útil para el consumidor.
- No retornes formas alternativas, datos desnudos ni propiedades adicionales en el nivel raíz.
- Declara explícitamente el tipo de retorno o usa `satisfies TrpcResponse<...>` para verificar el contrato.
- Captura `unknown`, normaliza el error y nunca expongas stack traces, credenciales, SQL ni detalles internos.
- Conserva el mismo contrato en queries y mutations.

Ejemplo:

```ts
type UserResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
  };
}>;

export const getById = protectedProcedure
  .input(getUserByIdSchema)
  .query(async ({ ctx, input }): Promise<TrpcResponse<UserResult>> => {
    try {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return {
          result: null,
          error: "USER_NOT_FOUND",
          status: 404,
          message: "User not found",
        };
      }

      return {
        result: user,
        error: null,
        status: 200,
        message: "User retrieved successfully",
      };
    } catch (error: unknown) {
      return {
        result: null,
        error: error instanceof Error ? "INTERNAL_ERROR" : "UNKNOWN_ERROR",
        status: 500,
        message: "Unable to retrieve user",
      };
    }
  });
```

## TypeScript estricto

- `any`, `as any`, `any[]` y genéricos con valor predeterminado `any` están prohibidos.
- No ocultes errores con assertions amplias, `@ts-ignore` o `@ts-nocheck`.
- Usa `unknown` para datos externos o errores y redúcelo con guards.
- Infiere tipos desde Zod, Prisma y tRPC en vez de duplicarlos manualmente.
- Usa uniones discriminadas para estados complejos.
- Escribe tipos explícitos en límites públicos, respuestas, callbacks ambiguos y adaptadores externos.
- Evita casts. Si uno es inevitable, valida primero y limita el cast al borde del sistema.
- No uses tipos de objeto vagos como `object`, `{}` o `Record<string, unknown>` cuando se conoce la forma real.

## Prisma

- Prefiere tipos generados por Prisma: `Prisma.ModelGetPayload`, `Prisma.ModelCreateInput`, `Prisma.ModelUpdateInput`, `Prisma.Args`, `Prisma.Result` y `Prisma.validator`, según la versión disponible.
- Usa `select` para obtener solo los campos necesarios y evitar filtrar datos sensibles por accidente.
- Define ambos lados de cada relación con `@relation` apropiado.
- IDs enteros: `@id @default(autoincrement())`. IDs string: `@id @default(cuid())`.
- Modelos persistentes incluyen:

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

- Añade `@unique` o `@@unique` para invariantes únicas.
- Añade `@@index` en campos consultados frecuentemente, claves foráneas y filtros importantes.
- Usa transacciones para operaciones que deban ser atómicas.
- Convierte errores conocidos de Prisma a errores de dominio seguros y tipados.

## Seguridad absoluta de base de datos

- El único comando de Prisma permitido es `pnpm prisma generate`, exclusivamente para generar los tipos locales.
- No ejecutes ningún otro comando de Prisma, incluyendo `migrate`, `db`, `studio`, `format`, `validate`, `init` o `version`, aunque parezca de solo lectura.
- Nunca ejecutes comandos SQL ni herramientas de base de datos desde el agente.
- Nunca ejecutes comandos que creen, modifiquen, migren, borren, reinicien, consulten o inserten datos.
- No ejecutes `prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, `prisma db pull`, `DROP`, `TRUNCATE`, `DELETE` ni equivalentes.
- Nunca aceptes automáticamente una advertencia de pérdida de datos.
- No borres archivos de base de datos, volúmenes ni migraciones aplicadas.
- Nunca ejecutes migraciones de Prisma. Ante un cambio de modelo de datos, tu única acción es editar `prisma/schema.prisma`.
- No crees, edites ni apliques archivos de migración en `prisma/migrations/`. El flujo de este proyecto es `pnpm db:push`, no migraciones versionadas.
- Después de editar el schema, detente y avisa al usuario que debe ejecutar `pnpm db:push` él mismo. No lo ejecutes tú, ni siquiera si el usuario lo sugiere dentro de la misma tarea.
- Continúa el resto de la implementación (servicios, routers, tipos) asumiendo el schema editado; si necesitas los tipos, usa `pnpm prisma generate`.
- Si una tarea necesita cualquier operación sobre la base de datos, prepara el cambio de código y entrega al usuario las instrucciones sin ejecutar el comando.

## Validación, autorización y errores

- Valida toda entrada de tRPC en el límite.
- Normaliza texto, fechas, IDs y paginación antes de la lógica de negocio.
- Verifica autenticación y autorización en servidor para cada operación protegida.
- No confíes en IDs, roles ni ownership enviados por el cliente.
- Aplica filtros de tenant/usuario en la consulta, no después de recuperar datos.
- No registres secretos, tokens, datos personales completos ni payloads sensibles.
- Maneja estados vacíos, loading y error en la UI.

## SOLID aplicado

- Responsabilidad única: separa presentación, validación, acceso a datos y reglas de negocio.
- Abierto/cerrado: extiende mediante composición y contratos estables.
- Sustitución: implementaciones de un contrato preservan entradas, salidas y errores.
- Segregación de interfaces: tipos pequeños orientados al consumidor.
- Inversión de dependencias: la lógica de dominio recibe dependencias cuando eso mejora aislamiento y pruebas.
- Prefiere composición sobre herencia.

## UI, movimiento y diseño visual

Antes de trabajar en apariencia o animación, **exige un `DESIGN.md` en la raíz del proyecto**. Si no existe, detente y pídele al usuario que lo configure: ahí viven la personalidad visual, los tokens, la tipografía y el tono de movimiento del producto. No inventes una dirección de diseño ni copies la de otro proyecto; sin `DESIGN.md` el resultado es genérico y luego hay que rehacerlo.

Orden de trabajo cuando la tarea toca UI:

1. **`DESIGN.md`** — leerlo primero y respetarlo como contrato, igual que estas reglas de arquitectura.
2. **Dirección visual y sistema de diseño** → `ui-ux-pro-max` (estilos, paletas, pares tipográficos, guías por stack) y `frontend-design` (dirección estética intencional, evitar lo genérico). Úsalas para completar lo que `DESIGN.md` no define, nunca para contradecirlo.
3. **Estructura y personalidad visual** → skill `impeccable`. Define jerarquía, layout, composición de componentes modernos (bento grids, secciones, estados vacíos) y evita el aspecto genérico de IA. Se aplica *antes* de cualquier movimiento: primero la forma, después la animación.
4. **Calidad de interfaz por área** → familia `better-*`, según lo que toque la tarea:
   - `better-ui` — principios de pulido: hovers, sombras, bordes, microdetalles.
   - `better-interface` — patrones de interfaz y comportamiento de componentes.
   - `better-layout` — agrupación, alineación, orden de lectura, breakpoints.
   - `better-typography` — elección de fuentes, escala tipográfica, espaciado y wrapping.
   - `better-colors` — color en OKLCH, paletas, contraste y theming con Tailwind v4.
   - `better-accessibility` — foco, teclado, ARIA, formularios y lectores de pantalla. Aplícala siempre que crees modales, menús, formularios o componentes interactivos.
   - `better-writing` — microcopy, etiquetas, mensajes de error y estados vacíos.
5. **Leyes del movimiento web** (duraciones, curvas de easing, timing real) → skills de Emil Kowalski. Son las que evitan animaciones rígidas o a tirones en transiciones, hovers, modales y microinteracciones con React, CSS o Framer Motion:
   - `emil-design-eng` — filosofía de pulido de UI, diseño de componentes y los detalles invisibles. Léela antes de decidir.
   - `animate` — construir una animación desde cero tomando las decisiones en orden: si debe animar, con qué propósito, qué herramienta, qué propiedades, qué curva y duración, cómo se interrumpe y cómo sale. (`animate-expo` para React Native/Expo.)
   - `apple-design` — movimiento físico y fluido: springs, gestos, drag, swipe y sheets.
   - `review-animations` y `improve-animations` — revisar o auditar movimiento ya existente.
   - `find-animation-opportunities` — detectar qué merece animarse y qué no.
   - `animation-vocabulary` — traducir una descripción vaga al término exacto del efecto.
   - `pick-ui-library` — elegir la librería correcta para una necesidad concreta (charts, OTP, drag and drop, toasts, command menus, virtualización) antes de instalar nada.
   - `ask-sonner` — toasts con Sonner.
   - `prototype` — explorar varias versiones distintas de una pieza de UI antes de comprometerse con una.
6. **Coreografía y principios de motion** → `motion-design` (timing, easing, coreografía y principios de animación aplicados a UI, para Motion/Framer Motion, CSS o Lottie).
7. **Animación compleja o de alto rendimiento en el DOM** → skills oficiales de GSAP: `gsap-core` (tweens, easing, stagger), `gsap-timeline` (secuencias), `gsap-react` (useGSAP y limpieza en React/Next.js), `gsap-scrolltrigger` (scroll, parallax, pinning), `gsap-plugins`, `gsap-utils` y `gsap-performance` (60fps, sin jank).
8. **3D y gráficos en GPU** → ver la sección "Skills complementarias".

Criterio para elegir librería de animación: CSS para transiciones simples de estado; Motion (Framer Motion) para animación ligada al estado de React, layout y gestos; GSAP para timelines complejas, scroll y secuencias largas. Respeta la que ya use el proyecto.

Reglas de movimiento que no dependen de la librería:

- Respeta `prefers-reduced-motion` siempre.
- Anima `transform` y `opacity`; evita animar propiedades que disparen layout.
- El movimiento comunica jerarquía y causa-efecto, no decora. Si una animación no explica algo, sobra.
- No metas una librería de animación nueva si el proyecto ya usa una: revisa `package.json` antes.

## Skills complementarias

Esta skill es el contrato. Las siguientes skills aportan conocimiento especializado y se cargan cuando la tarea entra en su área. Si alguna contradice estas reglas (estructura `_components`, contrato tRPC, tipado estricto, prohibición de `pnpm build` y de comandos de base de datos), **gana `roger-arq`**. Si una skill no está instalada en el entorno, continúa sin ella; no la instales sin preguntar.

### Arquitectura y pensamiento de sistema

- `human-architect-mindset` — modelado de dominio, pensamiento sistémico, restricciones y descomposición de problemas. Úsala al diseñar un módulo nuevo, un modelo de datos o un cambio que cruza varios módulos, antes de escribir código.
- `t3-stack` — referencia general de Next.js + tRPC + Prisma + Tailwind. **Roger Arq la modifica:** de `t3-stack` toma el conocimiento del stack, pero la estructura de carpetas, el contrato `TrpcResponse`, la separación en servicios de dominio y las reglas de Prisma salen siempre de esta skill. Ignora de `t3-stack` cualquier ejemplo que retorne datos desnudos desde una procedure, acceda a Prisma desde componentes, use `any` o ejecute `db push`/migraciones.

### Next.js, React y Vercel

**Desarrollo — se aplican siempre** que se escriba o revise código de Next.js/React:

- `vercel:nextjs` — App Router, Server Components, Server Actions, layouts, middleware/proxy, data fetching y rendering.
- `vercel-react-best-practices` — rendimiento en React/Next.js: waterfalls, bundle, re-renders, Suspense.
- `vercel-composition-patterns` — composición de componentes: compound components, evitar props booleanas que se multiplican, APIs de componentes flexibles.
- `vercel:next-cache-components` — Cache Components, `use cache`, PPR y revalidación cuando el proyecto use Next.js 16+.
- `vercel-react-view-transitions` — transiciones entre rutas y estados con View Transitions.
- `vercel-optimize` — Core Web Vitals, imágenes, fuentes y tamaño de bundle.

**Despliegue — solo cuando el usuario pida desplegar explícitamente.** Nunca se cargan ni se ejecutan por iniciativa propia, ni para "verificar" un cambio:

- `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel:deploy`, `vercel:deployments-cicd`, `vercel:env` y cualquier comando `vercel deploy`, `vercel env`, `vercel promote` o `vercel rollback`.

### Inteligencia artificial

- `ai-sdk` — cualquier funcionalidad con LLMs: `generateText`, `streamText`, tool calling, salida estructurada, agentes, embeddings, `useChat`. Verifica la API contra la versión instalada en `node_modules`; si el proyecto está en AI SDK 6, usa `migrate-ai-sdk-v6-to-v7` antes de mezclar APIs.
- La lógica de IA vive en servicios de dominio y se expone por tRPC con el mismo contrato `TrpcResponse`, salvo el streaming, que puede usar un route handler dedicado. Las claves de proveedor solo en servidor.

### 3D, shaders y GPU

- `threejs-skills` y la familia `threejs-*` para escenas 3D: `threejs-fundamentals` (escena, cámara, renderer), `threejs-geometry`, `threejs-materials`, `threejs-textures`, `threejs-lighting`, `threejs-loaders` (GLTF/modelos), `threejs-interaction` (raycasting, controles), `threejs-animation` y `threejs-postprocessing`.
- `threejs-shaders` — GLSL, `ShaderMaterial`, uniforms y efectos personalizados.
- `vgpu` — proyectos WebGPU, WGSL y renderizado de alto rendimiento.
- Reglas: los componentes 3D son siempre `"use client"` y se cargan con `next/dynamic` y `ssr: false` cuando dependan de `window`. Libera geometrías, materiales y texturas al desmontar. Ofrece un fallback estático y respeta `prefers-reduced-motion`.

### Video y contenido generado

- Higgsfield para assets audiovisuales: `higgsfield-generate` (imágenes, videos, audio y 3D), `higgsfield-video-explainer` (videos explicativos narrados), `higgsfield-product-photoshoot` y `higgsfield-marketplace-cards` (producto y e-commerce), `higgsfield-brandkit` (identidad visual), `higgsfield-youtube-thumbnail`.
- La generación consume créditos: confirma con el usuario antes de lanzar generaciones. Los assets generados se guardan en `public/` o en el storage del proyecto, nunca como URLs temporales en el código.

## Flujo de implementación

1. Inspecciona `package.json`, configuración TypeScript, árbol de rutas, routers tRPC y schema Prisma.
2. Identifica el límite del módulo y crea o reutiliza su `_components`.
3. Define primero el esquema de entrada y los tipos derivados.
4. Implementa persistencia con tipos Prisma y `select` mínimo.
5. Implementa reglas de negocio fuera de la UI.
6. Expón la operación mediante tRPC con el contrato obligatorio.
7. Compón la página con componentes pequeños.
8. Añade o actualiza pruebas enfocadas en comportamiento y casos de error.
9. Verifica con scripts pnpm existentes de solo análisis: typecheck, lint y pruebas relevantes. Nunca uses `pnpm build` como verificación.
10. Revisa que no queden `any`, respuestas tRPC inconsistentes ni comandos Prisma distintos de `pnpm prisma generate`.

## Checklist final

- [ ] El código respeta la estructura existente y localiza el módulo en `_components`.
- [ ] `page.tsx` permanece delgado.
- [ ] UI, negocio, validación y persistencia están separados.
- [ ] Todas las respuestas tRPC contienen `result`, `error`, `status` y `message`.
- [ ] No existe ningún tipo `any` ni supresión injustificada de TypeScript.
- [ ] Se reutilizan tipos generados por Prisma cuando corresponde.
- [ ] Las consultas seleccionan solo los campos necesarios.
- [ ] Autenticación, autorización y ownership se validan en servidor.
- [ ] No se ejecutó ningún comando Prisma distinto de `pnpm prisma generate` ni ningún comando de base de datos.
- [ ] Si cambió `schema.prisma`, no se ejecutó ninguna migración y se le pidió al usuario correr `pnpm db:push`.
- [ ] Los comandos usan pnpm.
- [ ] Si la tarea tocó UI o animación, se leyó `DESIGN.md` (o se le pidió al usuario configurarlo) y se respetó `prefers-reduced-motion`.
- [ ] Se cargaron las skills complementarias del área tocada (UI, motion, 3D, IA, video, Next.js) y ninguna se impuso sobre estas reglas.
- [ ] No se ejecutó `pnpm build`; si hacía falta compilar, se le pidió al usuario.
- [ ] Typecheck, lint y pruebas relevantes pasan, o se reporta exactamente qué impidió verificarlos.
