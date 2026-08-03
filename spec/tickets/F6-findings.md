# F6 — Hallazgos abiertos (no resueltos dentro de los tickets `F6-01`…`F6-18`)

Revisión de `spec/06-landing-polish.md` contra `spec/README.md`, `spec/00-foundations.md`,
`spec/01-auth.md`, `spec/02-business-dashboard.md`, `spec/04-subscriptions.md` y los 18
tickets de la fase. Los problemas **ya resueltos** dentro de un ticket están documentados
en su sección *Contexto* y se listan aquí solo como referencia (tabla final). Los
hallazgos que ya cubre la auditoría transversal se citan como "ya cubierto en XC-NN" para
no duplicarlos.

Severidades (mismo criterio que `XC-findings.md`): **bloqueante** (impide implementar o
corrompe datos/dinero), **mayor** (hueco que un agente no puede resolver sin inventar, o
riesgo real de seguridad/producto), **menor** (inconsistencia puntual, fix acotado).

---

## Mayores

### M1. El diseño de referencia `HOME360 Web.dc.html` no existe en el repo

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §4.3; también los criterios "replica las
  secciones y jerarquía de W1" (§Criterios) y `README.md` §Pantallas del diseño.
- **Descripción**: §4.3 exige "recorrido completo de las 13 pantallas contra el diseño
  (`HOME360 Web.dc.html`) como revisión final lado a lado", y F6-03…F6-06 describen la
  landing como réplica de ese diseño. El archivo **no está en el repositorio** (búsqueda
  en la raíz y en `spec/`: sin resultados); solo existe la referencia al proyecto Claude
  Design `8c4ad1a4-…` en `spec/README.md`. Un agente no puede verificar ningún criterio
  visual, y la landing debe construirse desde la descripción textual de §1 (que no
  incluye medidas, escalas tipográficas ni composición del hero visual).
- **Recomendación**: Roger deposita el HTML en `spec/design/HOME360-Web.dc.html` (o
  capturas por pantalla en `spec/design/W01…W13.png`) y `spec/README.md` lo referencia por
  ruta relativa. Si no es posible, reescribir §4.3 como "revisión visual ejecutada por
  Roger contra el proyecto Claude Design" y quitar la comparación con el diseño de los
  criterios de aceptación de los tickets (queda como revisión humana, no automatizable).
  Bloquea `F6-18`.

### M2. Ningún componente Magic UI respeta `prefers-reduced-motion`, y el `MotionSafe` de doble árbol tiene costes que la spec no contempla

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §1 (Reglas de motion), §Criterios
  ("`prefers-reduced-motion` deja la landing 100 % estática").
- **Descripción**: la auditoría prevista por la spec confirma el peor caso: **ninguno** de
  los 7 componentes instalados consulta la preferencia del usuario. `blur-fade`,
  `text-animate`, `number-ticker` y `animated-beam` animan con `motion` sin
  `useReducedMotion`; `shimmer-button` y `border-beam` animan con keyframes CSS puras
  (`animate-shimmer-slide`, `animate-border-beam`), que ni siquiera pasan por JS.
  El wrapper `MotionSafe` de `F6-01` (`children` animado + `fallback` estático,
  renderizando `fallback` durante SSR hasta que el efecto confirme la preferencia)
  funciona, pero arrastra tres costes que ningún ticket evalúa:
  1. **Doble árbol**: cada sección envía a la RSC payload el contenido animado *y* el
     estático → la landing (hero, 3 features, 3 pasos, 3 métricas, 3 planes, CTA) duplica
     casi todo su marcado.
  2. **Swap tras hidratación**: el usuario sin reduced motion ve primero la versión
     estática y, al hidratar, se sustituye por la animada, que arranca en `opacity: 0`
     → parpadeo del hero y salto de layout justo en el elemento LCP.
  3. **Dos copias del mismo copy** que hay que mantener sincronizadas — riesgo que el
     propio `F6-13` tiene que auditar ("el fallback contiene el mismo texto").
- **Recomendación**: sustituir la regla de §1 por un patrón híbrido y escribirlo en la
  spec: (i) `<MotionConfig reducedMotion="user">` de `motion/react` envolviendo la landing
  desactiva de golpe todas las animaciones basadas en motion (blur-fade, text-animate,
  number-ticker, animated-beam) sin duplicar marcado; (ii) una regla en
  `src/styles/globals.css` bajo `@media (prefers-reduced-motion: reduce)` que anule
  `animation`/`transition` de las clases CSS-driven (shimmer, border-beam) y el
  `scroll-behavior: smooth`; (iii) reservar `MotionSafe` **solo** para `AnimatedBeam`,
  único caso donde el marcado estático difiere de verdad (líneas SVG en vez de haz
  animado). Si se conserva `MotionSafe` tal cual, invertir el default de SSR: renderizar
  la versión visible por defecto y degradar por media query, para no depender de JS ni
  provocar el swap.

### M3. `deleteWorker` puede borrar un trabajador de otro negocio

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §2 (`/dashboard/team`); ticket `F6-08`
  (Detalle técnico, paso 3) vs. su propio criterio "imposible leer/mutar workers de otro
  negocio".
- **Descripción**: la guarda de `CONFLICT` consulta `service.findMany({ where: { businessId,
  status: "ACTIVE", workers: { some: { id } } } })` — correctamente filtrada por tenant —
  pero para un `workerId` de **otro** negocio esa consulta devuelve vacío (no hay conflicto)
  y el paso siguiente, escrito como `worker.delete` sin filtro, borraría el registro ajeno.
  El ticket confía en que `P2025 → NOT_FOUND` cubra el caso, pero `P2025` solo se lanza si
  el id no existe, no si pertenece a otro negocio.
- **Recomendación**: escribir el paso 3 como
  `db.worker.delete({ where: { id, businessId } })` (`extendedWhereUnique` de Prisma 6, ya
  usado por el `updateMany` del mismo ticket) o anteponer
  `findFirst({ where: { id, businessId }, select: { id: true } })` dentro de la misma
  transacción; añadir a `worker-team.test.ts` el caso "delete de worker ajeno →
  `NOT_FOUND` y el worker sigue existiendo".

### M4. El `CONFLICT` del último trabajador defiende un invariante que ninguna otra procedure mantiene

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §2 vs. `02-business-dashboard.md` §2
  (`service.update`, `service.setStatus`).
- **Descripción**: la regla "bloquea si es el único asignado a un servicio activo" **sí es
  verificable** con el schema de `spec/00` §3 — el m2m implícito `Worker.services` /
  `Service.workers` existe y `_count: { select: { workers: true } }` es consultable, tal
  como resuelve `F6-08`. El problema es de coherencia de negocio: el mismo invariante
  ("un servicio ACTIVE tiene ≥ 1 trabajador") se puede romper libremente desde W4 —
  `service.update` acepta `workerIds: []` y `service.setStatus` puede activar un servicio
  sin trabajadores — y desde el propio `spec/02` §2, que muestra "Sin asignar" atenuado
  como estado **normal** de un servicio. Resultado: la única vía por la que el sistema
  protege el invariante es la que el usuario percibe como arbitraria ("no puedo borrar a
  este trabajador, pero sí puedo desasignarlo del servicio y luego borrarlo").
- **Recomendación**: elegir y escribir en §2 una de las dos: (a) elevar el invariante a
  regla del dominio y validarlo también en `service.create/update/setStatus` de F2
  (implica cambiar F2 y aceptar que "Sin asignar" solo es válido en servicios `PAUSED`); o
  (b) degradar la guarda: permitir el borrado y advertir en la UI qué servicios quedan sin
  trabajador (`ConfirmDialog` con la lista), eliminando el `CONFLICT`. La opción (b) es la
  coherente con el resto de las specs. Nota residual ya asumida en `F6-08`: la
  verificación + delete en transacción no elimina la carrera con una escritura concurrente
  (Prisma no expone `SELECT … FOR UPDATE`); riesgo bajo y aceptado.

### M5. Cambiar la contraseña no invalida las sesiones existentes

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §2 (`businessSettings`, "cambio de contraseña
  con verificación de la actual"); `01-auth.md` §1 (`session: { strategy: "jwt" }`).
- **Descripción**: la coherencia con F1 está bien resuelta (`F6-10` usa
  `verifyPassword`/`hashPassword` de `src/server/services/auth/password.ts` y prohíbe
  importar `bcryptjs`, tal como exige `F1-02`). Lo que ninguna spec cubre es el efecto
  posterior: con sesión JWT y sin sesiones en BD, **los tokens ya emitidos siguen siendo
  válidos hasta expirar**. Si el dueño cambia la contraseña porque sospecha un
  compromiso, el atacante conserva el acceso desde su dispositivo. Es el caso de uso
  principal de la funcionalidad y queda sin cubrir.
- **Recomendación**: añadir `User.passwordChangedAt DateTime?` a `spec/00` §3 y, en el
  callback `jwt` de F1, invalidar el token cuando `token.iat < passwordChangedAt`
  (una comparación, sin consulta extra si se copia el timestamp al token). Mínimo
  aceptable si se descarta: documentar en §2 que el cambio no cierra otras sesiones y que
  el cliente ejecuta `signOut()` tras el éxito. Relacionado: la falta de rate limiting
  sobre `changePassword` (fuerza bruta de la contraseña actual desde una sesión válida)
  sigue abierta en `F1-findings` M3.

### M6. Las métricas de marketing de la landing son cifras inventadas

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §1 (`metrics-section`: "NumberTicker: negocios
  activos, órdenes, GMV (cifras estáticas de marketing)").
- **Descripción**: la spec pide la sección pero no da las cifras; `F6-02` siembra
  placeholders (≈1 200 negocios, 45 000 órdenes, GMV $12 M MXN) marcados
  `// marketing figures — Roger confirms`. Para una plataforma pre-lanzamiento son
  afirmaciones públicas y comprobablemente falsas (riesgo de publicidad engañosa), y para
  el implementador son indistinguibles de datos reales: nada impide que lleguen a
  producción, porque ningún criterio de aceptación las bloquea. Además el `NumberTicker`
  les da el peso visual de un dato medido.
- **Recomendación**: decisión de Roger antes del release, con tres salidas escritas en §1:
  (a) cifras reales confirmadas; (b) sustituir la sección por señales cualitativas de
  confianza (tipos de garantía, cobertura, tiempo de respuesta, "pagos protegidos"), que
  es lo honesto pre-lanzamiento; o (c) conservarlas con nota al pie visible ("cifras
  ilustrativas"). Hasta que se decida, `F6-18` no puede dar por buena la landing.

### M7. Las dependencias declaradas de la fase son incorrectas más allá de `assertPlanLimit`

- **Severidad**: mayor
- **Spec afectada**: `README.md` (mapa: "06-landing-polish | F1"),
  `06-landing-polish.md` línea 4 ("Requiere F1 (puede correr en paralelo a F3–F5)").
- **Descripción**: **ya cubierto en XC-04** en su parte de `assertPlanLimit` (F2/F4).
  Lo que XC-04 no señala: la dependencia real es más amplia y de otra naturaleza. §2 usa
  además el patrón de módulo y los compartidos de F2 (`DataTable`, `ConfirmDialog`,
  `EmptyState`, `PageHeader`, prefetch + `HydrateClient`, `branch.list` para el Select de
  sucursal); y §3–§4 **no pueden correr en paralelo a F3–F5 en absoluto**: los cinco
  barridos de calidad recorren W3–W13 (pagos, suscripción, admin, disputas, finanzas) y
  el `pnpm build` de §4 compila el proyecto entero. Con la cadena declarada, más de la
  mitad de la fase es inejecutable.
- **Recomendación**: partir la fase en el README y en la cabecera de `spec/06`:
  **F6a — landing W1 + team + settings** (depende de F2, puede correr en paralelo a
  F3–F5) = tickets `F6-01`…`F6-11`; **F6b — pase de calidad, build y recorrido final**
  (depende de F5, es la última fase del proyecto) = tickets `F6-12`…`F6-18`. No hace falta
  renumerar tickets.

### M8. El universo "W1–W13" deja fuera cuatro pantallas reales, dos de ellas creadas por esta fase

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §3 ("checklist ejecutado pantalla por pantalla
  (W1–W13)"), §4.3 y §Criterios; `README.md` §Pantallas del diseño.
- **Descripción**: la tabla del README numera 13 pantallas y no incluye `/register` (F1
  §4), `/dashboard/orders` (F2 §5), ni `/dashboard/team` y `/dashboard/settings`, que
  nacen en esta misma fase. Los barridos `F6-12`…`F6-16` sí las recorren (sus alcances las
  enumeran), pero los criterios de aceptación hablan de "las 13 pantallas", con lo que un
  agente puede darlas por fuera del checklist. Y §4.3 pide compararlas contra el diseño,
  que no las contiene (team y settings no tienen pantalla en `HOME360 Web.dc.html`).
- **Recomendación**: en `README.md` extender la tabla con W14 `/dashboard/orders`,
  W15 `/dashboard/team`, W16 `/dashboard/settings` y W17 `/register`, marcando las tres
  últimas como "sin diseño de referencia — replican el patrón de W4/W8"; en `spec/06` §3
  y §4 sustituir "las 13 pantallas" por "todas las rutas de la app" y acotar la revisión
  lado a lado a las que sí tienen diseño.

### M9. Las keyframes de `shimmer-button` y `border-beam` pueden no aterrizar en Tailwind 4, y el fallo es silencioso

- **Severidad**: mayor
- **Spec afectada**: `06-landing-polish.md` §1 (Setup Magic UI);
  `00-foundations.md` §7 (`globals.css`, tokens zinc).
- **Descripción**: `shimmer-button` y `border-beam` no animan con `motion`: dependen de
  utilidades y `@keyframes` (`animate-shimmer-slide`, `animate-spin-around`,
  `animate-border-beam`) que el registry de shadcn entrega como bloque CSS / `cssVars` o,
  en entradas antiguas, como `theme.extend.keyframes` de un `tailwind.config.js` que este
  proyecto **no tiene** (Tailwind 4, configuración CSS-first). Si el bloque no aterriza en
  `src/styles/globals.css`, los componentes compilan, renderizan y **no animan**, con
  `pnpm typecheck` y `pnpm check` en verde: ningún criterio de `F6-01` detecta el fallo.
  Segundo efecto: el `shadcn add` **escribe en `globals.css`**, archivo propiedad de F0
  (tokens zinc, radio 8 px, Geist Mono) — hay riesgo de duplicar variables o pisar tokens,
  y §1 no advierte que la instalación toca el CSS global.
- **Recomendación**: añadir a §1 dos frases normativas: (i) "tras el `shadcn add` se revisa
  el diff de `src/styles/globals.css`: las keyframes de `shimmer-button` y `border-beam`
  deben existir bajo `@theme`/`@keyframes` y los tokens zinc de F0 quedar intactos";
  (ii) un criterio de aceptación observable en `F6-01`/`F6-18` — "el CTA del hero muestra
  el shimmer y la feature card muestra el border beam en hover en la build de producción".

---

## Menores

### m1. `text-animate` solo se justifica por una decisión tomada en un ticket

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (Setup Magic UI vs. Estructura).
- **Descripción**: **auditoría del comando de instalación contra la estructura: los 7
  componentes se usan y no falta ninguno** — `blur-fade` (entradas escalonadas),
  `text-animate` (titular), `shimmer-button` (CTA primario del hero), `bento-grid`
  (features), `number-ticker` (métricas), `animated-beam` (hero visual), `border-beam`
  (hover de las feature cards). El matiz: la estructura dice "titular con
  **BlurFade/TextAnimate**" sin elegir; si el implementador optase por BlurFade —lectura
  igual de válida de la spec— `text-animate` quedaría instalado y sin uso. `F6-04` cierra
  la ambigüedad eligiendo TextAnimate, pero la spec sigue permitiendo la otra lectura.
- **Recomendación**: fijar en §1 "titular en `TextAnimate` (`by="word"`, una sola vez)" y
  dejar el comando de instalación intacto.

### m2. De `bento-grid` solo se aprovecha el contenedor; `BentoCard` queda como código muerto

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (`features-section`, `feature-card`).
- **Descripción**: el registry entrega `BentoGrid` (un grid CSS de pocas líneas) y
  `BentoCard`, cuya API impone icono + nombre + descripción + `href` + CTA + `background`.
  La tarjeta de la spec es **no interactiva** (`F6-05`: "sin `onClick`, las cards no son
  botones"), así que se usa un `FeatureCard` propio y `BentoCard` queda sin consumir en
  `src/components/ui/bento-grid.tsx` (arrastrando sus imports).
- **Recomendación**: aceptarlo y anotarlo en §1 ("de `bento-grid` se usa solo el
  contenedor"), o eliminar `BentoCard` del archivo generado tras la instalación. Sin
  impacto funcional; conviene decidirlo para que el barrido de calidad no lo reporte como
  hallazgo.

### m3. "Server Components salvo animaciones" es cierto solo en la forma

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (primer párrafo).
- **Descripción**: con `BlurFade`/`MotionSafe` envolviendo badge, titular, subtítulo, CTAs,
  cada feature card, cada paso, cada métrica y cada plan, prácticamente todo el contenido
  de la landing atraviesa un límite cliente (y, con el doble árbol de M2, se serializa dos
  veces). Los tickets lo hacen bien —el marcado se crea en el servidor y viaja como
  `children` de un wrapper cliente— pero la spec no lo dice, y un implementador puede
  concluir que le basta con marcar cada sección con `"use client"`, perdiendo el
  prerender. El `landing-header` además es cliente solo por la sombra al hacer scroll.
- **Recomendación**: en §1, sustituir "único código cliente: animaciones Magic UI y el
  header sticky" por la regla operativa: "las secciones son Server Components; los
  wrappers de animación son los únicos componentes cliente y reciben el contenido ya
  renderizado como `children` — ninguna sección lleva `"use client"`". Opcional: sustituir
  el estado de scroll del header por un centinela `IntersectionObserver` (o
  `animation-timeline: scroll()` con fallback) y dejar el shell 100 % declarativo.

### m4. `team.list` lee `plan.maxWorkers` bajo `businessProcedure`, donde el plan puede ser `null`

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §2; `00-foundations.md` §5.
- **Descripción**: **ya cubierto en XC-20** (`ctx.business.plan` es `Plan | null` para
  negocios PENDING o sin suscripción y ningún consumidor lo contempla). Instancia concreta
  de esta fase: `list` corre en `businessProcedure` (decisión correcta de `F6-08`) y
  devuelve `limit: { used, max: plan.maxWorkers }`; un negocio PENDING que abra
  `/dashboard/team` obtiene un acceso a propiedad de `null` o un contador
  "X de undefined trabajadores".
- **Recomendación**: en `F6-08`, tipar `limit.max: number | null` resolviéndolo como
  `business.subscription?.plan.maxWorkers ?? null` y que `F6-09` muestre el copy
  `team.unlimited` / "sin plan" según corresponda; o mover `list` a
  `activeBusinessProcedure` y dejar la ruta tras el aviso de cuenta pendiente.

### m5. `businessSettings` completo bajo `businessProcedure`: un negocio SUSPENDED puede editar su perfil comercial

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §2 ("router `businessSettings` (business)") vs.
  `02-business-dashboard.md` §0 (mutaciones con `activeBusinessProcedure`).
- **Descripción**: `F6-10` resuelve deliberadamente usar `businessProcedure` en todo el
  router, con buen argumento para el cambio de contraseña y la lectura del perfil
  (operaciones de cuenta). El efecto lateral no discutido es que un negocio **SUSPENDED**
  —suspendido por el admin en W10— puede seguir cambiando nombre comercial, tipo y notas
  de garantía.
- **Recomendación**: escribir la distinción en §2 ("operaciones de cuenta —perfil del
  dueño y contraseña— usan `businessProcedure`; las operaciones comerciales usan
  `activeBusinessProcedure`") y decidir de qué lado cae el nombre/tipo del negocio. Si cae
  del lado comercial, dividir en `updateOwner` (business) y `updateBusinessProfile`
  (activeBusiness).

### m6. `businessType` es editable pese a que la aprobación admin se dio sobre un tipo concreto

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §2 ("nombre, tipo, notas de garantía (solo
  lectura de `guaranteeType` — cambiarla requiere re-aprobación admin)").
- **Descripción**: la spec bloquea `guaranteeType` por requerir re-aprobación, pero deja
  `type` (SERVICES/PRODUCTS/MIXED) libremente editable, cuando fue parte del expediente
  que el admin aprobó en W10 y determina qué módulos del dashboard tienen sentido (un
  negocio SERVICES que se pasa a PRODUCTS aparece con catálogo vacío y límites de plan
  distintos). Asimetría no argumentada en ninguna spec.
- **Recomendación**: o aplicar a `type` la misma regla y nota que a `guaranteeType`, o
  documentar en §2 que el cambio es libre y que W10 muestra el tipo vigente. Decisión de
  producto de Roger; el coste de implementación es el mismo.

### m7. `changePassword` sin regla "la nueva debe ser distinta de la actual"

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §2.
- **Descripción**: la longitud mínima (8) sí es coherente con el registro de `01-auth.md`
  §2, y la confirmación en cliente la resuelve `F6-11`. Falta la comprobación trivial de
  que la contraseña nueva no sea idéntica a la actual (hoy el flujo "exitoso" puede no
  cambiar nada), y no hay ninguna otra política escrita.
- **Recomendación**: añadir `.refine((v) => v.newPassword !== v.currentPassword)` al schema
  del **router** (no solo del formulario) en `F6-10`, con el código `VALIDATION_ERROR`.
  Nota de dependencia: el código de dominio `CURRENT_PASSWORD_INVALID` requiere la firma
  generalizada de `fail`, que sigue abierta como **`F1-findings` A1**.

### m8. Copy de error por módulo compitiendo con `errors.json`

- **Severidad**: menor
- **Spec afectada**: `00-foundations.md` §4 y §6 ("`errors.json` tiene una clave por cada
  código de error del contrato"); `06-landing-polish.md` §2.
- **Descripción**: `F6-09` traduce el `CONFLICT` del borrado de trabajador con
  `dashboard.json:team.errors.CONFLICT` (mensaje específico y correcto para la UX), pero
  el código genérico también tiene su clave en `errors.json`. Sin una regla escrita, el
  mismo código muestra textos distintos según pantalla y `F6-14` no sabe cuál validar.
- **Recomendación**: escribir la regla en F0 §4/§6 — "`errors.json` provee el mensaje por
  defecto de cada código; un módulo puede sobrescribirlo en su namespace bajo
  `<módulo>.errors.<CODE>`" — y que el test de paridad de `F6-14` acepte ambas fuentes
  verificando que la override exista en es y en.

### m9. El seed no permite verificar ni la columna "sucursal" ni el límite de trabajadores

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §2 y §4.2; `00-foundations.md` §9.
- **Descripción**: `F6-07` añade `Worker.branchId` pero el seed de F0 no asigna sucursal a
  los 2 trabajadores de "Plomería García", así que la columna nueva mostrará "—" en todas
  las filas. Y el `PLAN_LIMIT_REACHED` de `workers` no es demostrable: el único negocio
  ACTIVE está en plan `standard` (15 trabajadores) con 2 sembrados. Relacionado con
  **XC-10** (falta un negocio en plan `basic`).
- **Recomendación**: en F0 §9, asignar sucursal a los 2 trabajadores existentes y sembrar
  el negocio `basic` de XC-10 con exactamente 3 trabajadores (su límite), de modo que
  "crear el cuarto" dispare el error en un clic. `F6-07` ya lista la actualización del
  seed como tarea opcional de Roger: conviene volverla obligatoria.

### m10. Deriva entre `spec/00` §3 y el `schema.prisma` real por `Worker.branchId`

- **Severidad**: menor
- **Spec afectada**: `00-foundations.md` §3 (modelos `Worker`/`Branch`);
  `06-landing-polish.md` §2.
- **Descripción**: **ya cubierto en XC-07** en cuanto al hueco (la columna "sucursal" no
  tiene relación en el schema). Lo que queda abierto: `F6-07` aplica el cambio al
  `prisma/schema.prisma` real, pero por la regla de la auditoría **ninguna spec fue
  modificada**, así que a partir de ese commit `spec/00` §3 deja de describir el schema
  vigente (y lo mismo ocurrirá con `XC-01`, `XC-05` y demás tickets de schema).
- **Recomendación**: regla de proceso — cada ticket que toque `prisma/schema.prisma` debe
  actualizar el bloque correspondiente de `spec/00` §3 en el mismo commit. Aplicarlo
  retroactivamente a los tickets XC de schema ya escritos.

### m11. "Descargar la app" queda como botón permanentemente deshabilitado

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (`cta-section`).
- **Descripción**: la spec pide el botón, pero no existe app publicada ni URL de stores.
  `F6-06` lo resuelve como botón deshabilitado + "Disponible próximamente" (mejor que un
  `href="#"` roto) y deja la decisión abierta. Un CTA final con un botón muerto resta
  conversión y llama la atención sobre lo que falta.
- **Recomendación**: decisión de Roger — ocultarlo hasta que existan las stores (la opción
  más limpia: el CTA final se queda con "Registra tu negocio", que es el objetivo real de
  W1), o enlazar a una captura de correo para el lanzamiento.

### m12. La navegación por anclas desaparece en móvil sin alternativa

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (`landing-header`).
- **Descripción**: `F6-03` decide ocultar la nav de anclas en móvil "sin menú hamburguesa"
  (decisión de alcance razonable, pero no está en la spec). En 375 px el usuario pierde el
  acceso directo a "Cómo funciona / Para negocios / Garantías / Precios" y solo le queda
  el scroll.
- **Recomendación**: aceptarlo y anotarlo en §1, o añadir un `Sheet` (componente ya
  instalado en F0) con las 4 anclas + los 2 CTAs: coste bajo y consistente con el patrón
  responsive del resto de la app (`F6-15`).

### m13. Los precios de la landing son un espejo manual del seed

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §1 (`pricing-section`: "reusa datos estáticos,
  no BD").
- **Descripción**: `F6-02` define `LANDING_PLANS` como constantes espejo de
  `prisma/seed.ts` (49900/12 %, 99900/8 %, 199900/5 %). Correcto —la landing no debe pegar
  a BD— pero un cambio de precio en el seed, en Stripe o en `spec/04` §1 no se refleja en
  la landing y nadie se entera: es exactamente el tipo de deriva que produce una página
  pública con precios equivocados.
- **Recomendación**: extraer los 3 planes a un módulo compartido (`src/lib/plans.ts`)
  consumido por `prisma/seed.ts` y por la landing; si se prefiere no acoplarlos, añadir un
  test que compare `LANDING_PLANS` contra las constantes del seed y falle ante cualquier
  divergencia.

### m14. `pnpm check` no cubre el formato y §4 no lo pide

- **Severidad**: menor
- **Spec afectada**: `06-landing-polish.md` §4.1.
- **Descripción**: `check` es `next lint && tsc --noEmit`; el formato (Prettier, incluido
  el orden de clases Tailwind del plugin) solo se verifica con `pnpm format:check`, que ya
  existe en `package.json` y no aparece en ninguna secuencia de verificación de las specs.
- **Recomendación**: añadir `pnpm format:check` a la lista de §4.1 (y, si se quiere,
  incorporarlo al script `check`).

---

## Huecos de cobertura y tickets nuevos

Cobertura de `spec/06-landing-polish.md` por los tickets existentes:

| Sección de spec | Tickets | Estado |
|-----------------|---------|--------|
| §1 Setup Magic UI + reglas de motion | `F6-01` | cubierto (riesgos abiertos en M2, M9) |
| §1 Copy y datos estáticos | `F6-02` | cubierto (M6 abierto) |
| §1 Estructura (11 componentes) | `F6-03`…`F6-06` | cubierto (+`pricing-card.tsx` añadido) |
| §2 `/dashboard/team` | `F6-07`, `F6-08`, `F6-09` | cubierto (M3, M4, m4, m9 abiertos) |
| §2 `/dashboard/settings` | `F6-10`, `F6-11` | cubierto (M5, m5, m6, m7 abiertos) |
| §3 Estados · a11y · i18n · responsive · tipografía+consistencia | `F6-12`…`F6-16` | cubierto (las 6 dimensiones del checklist) |
| §4.1 `typecheck`/`check`/`vitest` | cada ticket | cubierto |
| §4.1 `pnpm build` + contrato uniforme del `appRouter` | **ninguno** | **hueco → `F6-17` (nuevo)** |
| §4.2 y §4.3 verificación manual y revisión contra el diseño | **ninguno** | **hueco → `F6-18` (nuevo)** |

### G1 — Nadie ejecutaba la build de producción ni auditaba el contrato

Los 16 tickets cierran en `typecheck`/`check`/`vitest`; §4.1 exige además `pnpm build`
("primera build de producción completa del proyecto") y los criterios de aceptación piden
"contrato `TrpcResponse` uniforme en todo el `appRouter`", que ninguna fase comprueba de
forma agregada. Creado **`F6-17-production-build-and-contract-audit.md`** (build + fixes
de fronteras server/client y rendering estático de `[locale]`, auditoría de routers y
guarda de tipos permanente sobre `inferRouterOutputs<AppRouter>`).

### G2 — Nadie ejecutaba la verificación manual final

§4.2 (landing es/en, móvil y desktop, `prefers-reduced-motion`, anclas, CTAs → `/register`)
y §4.3 (recorrido de todas las pantallas contra el diseño) no tenían ticket. Creado
**`F6-18-final-manual-verification-pass.md`**, con la matriz de verificación por ruta y la
dependencia explícita de M1 (el diseño de referencia debe existir en el repo).

---

## Resueltos en tickets (referencia)

| # | Problema detectado | Resolución | Ticket |
|---|--------------------|------------|--------|
| R1 | ¿Sobra o falta algún `@magicui/*` del comando de instalación? | Los 7 se usan y ninguno falta (ver m1 para el matiz de `text-animate`) | `F6-01` |
| R2 | Magic UI no garantiza `prefers-reduced-motion` | Wrapper `MotionSafe` + auditoría documentada por componente (costes abiertos en M2) | `F6-01` |
| R3 | Anclas "Para negocios" y "Garantías" sin sección destino | Mapa fijo `LANDING_ANCHORS` + ids con `scroll-margin-top` | `F6-02`, `F6-03`, `F6-05`, `F6-06` |
| R4 | "Titular con BlurFade/TextAnimate" sin elegir | `TextAnimate` por palabra en el `h1`; `BlurFade` en el resto | `F6-04` |
| R5 | Placeholder de landing de F0 colisiona con `(public)/page.tsx` (XC-16) | `F6-03` elimina el placeholder al montar el shell | `F6-03` |
| R6 | `pricing-card.tsx` ausente de la estructura pese a la regla de componentización | Se crea como archivo propio | `F6-06` |
| R7 | "Descargar la app" sin URL ni app publicada | Botón deshabilitado + "Disponible próximamente" (decisión abierta en m11) | `F6-06` |
| R8 | Columna "sucursal" sin relación `Worker↔Branch` (XC-07) | `Worker.branchId String?` + `Branch.workers` + `@@index`, `onDelete: SetNull` | `F6-07` |
| R9 | F6 declara depender solo de F1 pero usa `assertPlanLimit` (XC-04) | El ticket depende de F2 y crea `plan-limits.ts` con la firma de `spec/04` §3 si falta | `F6-08` |
| R10 | "Router `team` (activeBusiness)" vs. regla de `spec/02` §0 | `list` → `businessProcedure`; `create/update/delete` → `activeBusinessProcedure` | `F6-08` |
| R11 | ¿Es verificable el `CONFLICT` del último worker con el m2m de `spec/00`? | Sí: `Service.workers`/`Worker.services` + `_count.workers === 1` sobre servicios ACTIVE, en transacción (carrera residual aceptada; coherencia abierta en M4) | `F6-08` |
| R12 | Doble fuente de escritura del m2m worker↔service | Solo lectura en team; la asignación vive en el form de servicios (W4) | `F6-09` |
| R13 | Cambio de contraseña vs. servicio de password de F1 | `verifyPassword`/`hashPassword` de `auth/password.ts`; prohibido importar `bcryptjs` | `F6-10` |
| R14 | `User.passwordHash` nullable (cuentas OAuth) | Mismo `CURRENT_PASSWORD_INVALID` sin revelar el motivo | `F6-10` |
| R15 | `guaranteeType` podría modificarse por API | Fuera del input Zod; solo `guaranteeNotes` es editable | `F6-10` |
| R16 | La spec define un único `update` para perfil + contraseña | Split `updateProfile` / `changePassword` con su propio código de error | `F6-10`, `F6-11` |
| R17 | "Confirmar contraseña" no cabe en el input del router | Campo solo-cliente validado con `refine` antes de mutar | `F6-11` |
| R18 | §3 como un único mega-ticket de calidad | Un ticket por dimensión: estados, a11y, i18n, responsive, tipografía+consistencia | `F6-12`…`F6-16` |
| R19 | Paridad es/en sin garantía automatizada | `messages-parity.test.ts` (claves + cobertura de códigos de error) | `F6-14` |
| R20 | Cifras de métricas sin definir en la spec | Placeholders marcados y escalados a este documento (M6) | `F6-02` |

---

## Correcciones recomendadas a `spec/06-landing-polish.md`

1. **Cabecera (línea 4)**: sustituir "Requiere F1 (puede correr en paralelo a F3–F5)" por
   la partición de M7 — §1 y §2 requieren **F2**; §3 y §4 requieren **F5** y cierran el
   proyecto. Actualizar en paralelo la fila `06-landing-polish.md` del mapa de fases de
   `spec/README.md` (M7, XC-04).
2. **§1, primer párrafo**: reescribir la regla de Server Components como en m3 ("las
   secciones son Server Components; los wrappers de animación son los únicos componentes
   cliente y reciben el contenido como `children`; ninguna sección lleva `"use client"`").
3. **§1 Setup Magic UI**: añadir que la instalación **modifica `src/styles/globals.css`**
   y que hay que revisar el diff (keyframes de `shimmer-button`/`border-beam` presentes,
   tokens zinc de F0 intactos), con un criterio observable de "shimmer y border beam
   visibles en la build de producción" (M9). Anotar que de `bento-grid` solo se usa el
   contenedor (m2).
4. **§1 Reglas de motion**: sustituir el `MotionSafe` universal por el patrón híbrido de
   M2 — `MotionConfig reducedMotion="user"` para los componentes basados en `motion`,
   media query CSS para los CSS-driven, y `MotionSafe` reservado a `AnimatedBeam`.
5. **§1 `hero-section`**: fijar "titular en `TextAnimate` (`by="word"`, una sola vez)" en
   lugar de "BlurFade/TextAnimate" (m1).
6. **§1 Estructura**: añadir `pricing-card.tsx` a la lista de componentes (R6) y el mapa de
   anclas → sección (`#how-it-works`, `#for-business`, `#guarantees`, `#pricing`) con la
   nota de `scroll-margin-top` (R3); documentar el comportamiento móvil de la nav (m12).
7. **§1 `metrics-section`**: resolver el origen de las cifras (M6) — reales, sustituir la
   sección por señales cualitativas, o marcarlas como ilustrativas en la propia UI.
8. **§1 `pricing-section`**: declarar la fuente única de los planes y la protección contra
   deriva (m13); **§1 `cta-section`**: decidir el destino de "Descargar la app" (m11).
9. **§2 team**: elegir y escribir la política del invariante "servicio ACTIVE con ≥ 1
   trabajador" (M4); incluir el Select de sucursal en el Sheet y la columna asociada
   apuntando al cambio de schema de `spec/00` §3 (XC-07, m10); precisar que `list` corre en
   `businessProcedure` y que `limit.max` es `number | null` cuando no hay plan (m4, XC-20);
   exigir que el borrado filtre por tenant (M3).
10. **§2 settings**: separar explícitamente "operaciones de cuenta" (`businessProcedure`)
    de "operaciones comerciales" (`activeBusinessProcedure`) y decidir de qué lado cae el
    perfil del negocio (m5); aplicar a `businessType` la misma regla que a `guaranteeType`
    o documentar su libertad (m6); añadir la regla "la contraseña nueva difiere de la
    actual" y la política de sesiones tras el cambio (M5, m7).
11. **§3**: sustituir "pantalla por pantalla (W1–W13)" por "todas las rutas de la app" e
    incorporar `/register`, `/dashboard/orders`, `/dashboard/team` y `/dashboard/settings`
    a la tabla de pantallas del README (M8).
12. **§4.1**: añadir `pnpm format:check` a la secuencia de verificación (m14) y explicitar
    que la build de producción y la auditoría del contrato son un entregable con dueño
    (`F6-17`).
13. **§4.3**: condicionar la revisión lado a lado a que el diseño esté versionado en
    `spec/design/` y acotarla a las pantallas que el diseño contiene (M1, M8); el recorrido
    manual pasa a ser el entregable de `F6-18`.
