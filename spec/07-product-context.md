# Contexto de producto — App móvil y modelo de negocio

**Este documento no es una fase de implementación.** La app móvil está fuera del alcance del
sistema web (F0–F7). Existe para que las decisiones que tomemos en el backend no cierren
puertas al resto del producto, y para dejar registro de dónde la documentación de negocio
contradice a las specs actuales.

> **Estado normativo:** los diagnósticos de §§4–5 son el registro histórico previo a la
> decisión. `08-business-model-alignment.md` ya resolvió comisión, tarifa, bono, cuentas
> corporativas, schema inicial, D6, marca y métricas (D1–D8). No deben volver a tratarse como
> pendientes; solo siguen abiertos los bloqueos enumerados en `PENDIENTES.md` y los huecos
> explícitos de sus tickets.

Fuentes, ya versionadas en `design/`:

| Archivo | Qué es |
|---------|--------|
| `design/HOME360-Web.dc.html` | Diseño de las 13 pantallas web (W1–W13) — la fuente de F0–F6 |
| `design/HOME360-App-Movil.dc.html` | Diseño de la app móvil: 6 pantallas cliente (C1–C6), 7 de negocio (N1–N7), 4 de trabajador (T1–T4) |
| `design/pdf_pages/page-01…18.png` | Deck de socios 2025: problema, solución, garantías, modelo de negocio, financieros y brandbook |

> Las páginas 06, 13, 14, 15 y 16 llegaron truncadas por el límite de 256 KiB del MCP; se
> recuperó la mitad superior de cada una (`page-NN-partial.jpg`). El PDF original completo
> sigue solo en el proyecto de Claude Design.

## 1. La app móvil en una página

Una sola app con tres modos según el rol de la cuenta:

- **Cliente (C1–C6)**: home con categorías y productos → cámara → diagnóstico IA (problema,
  confianza, categoría, rango de precio justo, producto + servicio sugeridos) → cotizaciones
  de varios negocios → detalle de oferta con desglose y pago a escrow → seguimiento en vivo
  con mapa, línea de tiempo y confirmación que libera el pago.
- **Negocio (N1–N7)**: radar de solicitudes cercanas con push → detalle con evidencia y
  diagnóstico IA, asignación de trabajador, precio y horario → chat con el cliente → wallet
  (disponible, escrow, bonos de lealtad, movimientos, retiros) → equipo → perfil.
- **Trabajador (T1–T4)**: solo sus órdenes asignadas, ruta del día, grabación obligatoria del
  servicio, cierre con evidencia antes/después, notas y materiales, y su propio perfil con
  toggle de disponibilidad.

La app dice explícitamente que sucursales y administración completa **viven en la web**
(`/dashboard`), lo que confirma el reparto de responsabilidades que ya asumen las specs.

## 2. Reglas de negocio que la web tendrá que respetar

Estas salen del deck y de la app, y aplican al mismo backend que estamos construyendo:

1. **La grabación del servicio es obligatoria e ininterrumpida.** Su ausencia o interrupción
   **resuelve automáticamente la disputa a favor del cliente** (deck §4 y pantalla T2). W11
   resuelve disputas sin conocer esta regla.
2. **El pago se libera con confirmación del cliente**, o automáticamente a las 72 h sin
   reclamo — coincide con `escrowAutoReleaseHours` de `PlatformSettings`.
3. **La garantía tiene dinero detrás**: depósito de $3,000–$10,000 MXN en fideicomiso, o
   micro-seguro por servicio, o bien inmueble/mueble registrado, o solo verificación
   (INE, biometría, antecedentes), o la combinada A+B. El perfil del negocio muestra el monto
   vigente ("Depósito $5,000 + seguro por servicio · vigente").
4. **Verificación documental existe**: el perfil de negocio muestra "Documentos y
   verificación · Completo". Esto responde la decisión abierta `F0-findings` B1 — sí hace
   falta un modelo de documentos, no es invención de W10.
5. **Tarifa de servicio de $25** al cliente, ya presente en `PlatformSettings`.
6. **Lanzamiento en Chihuahua** (934 000 hogares, 500+ proveedores listos), expansión al norte
   y luego nacional. Relevante para el seed y para el radio de cobertura por defecto.

## 3. Huecos de modelo que la app revela

Ninguno bloquea F0–F6, pero todos tocan tablas que estamos por migrar en `F0-03`. `08` D5
ya decidió cuáles entran y `F0-12` materializa esa selección; esta tabla no reabre la decisión.
significa una segunda migración cuando la app entre.

| # | Hueco | Impacto |
|---|-------|---------|
| 1 | **No existe entidad de cotización/oferta.** En C4 varios negocios ofertan sobre una misma solicitud, con precio, horario, trabajador asignado y garantía; el cliente acepta una. Hoy `Order` va directo de cliente a negocio. | Alto — cambia la raíz del modelo de órdenes |
| 2 | **Mensajería por orden** (N3, cliente↔negocio, con ubicación en vivo y adjuntos). No existe en ningún spec. | Medio — tabla propia; admin podría necesitarla como evidencia en disputas |
| 3 | **`Worker` es mucho más rico**: especialidad (plomero, electricista, repartidor), estado en vivo (disponible / en servicio / descanso), calificación, horario, y **alta por invitación con correo** (estado "invitación enviada", acción reenviar). El router `team` de F6 solo hace CRUD. | Medio — afecta `F6-07`/`F6-08` |
| 4 | **Cierre de servicio**: evidencia antes/después, notas y materiales usados con precio. La orden hoy no guarda nada de esto, y son justo las pruebas que el admin mira en una disputa. | Medio |
| 5 | **Bono de lealtad** aparece como saldo y como movimiento en la wallet del negocio. Confirma que `XC-06` / `F5-7` (bonos sin modelo fuente) es un hueco real, no un error del diseño. | Medio |

## 4. Contradicciones históricas — resueltas por `08`

### 4.1 El modelo de ingresos del deck no es el de las specs

| | Deck de socios | Diseño web (lo que implementan las specs) |
|---|---|---|
| Comisión | 10 % individual · 8 % B2B estándar · 5 % B2B empresarial | Por plan del proveedor: 12 % básico · 8 % estándar · 5 % empresarial |
| Suscripción | **Membresía de clientes B2B**: $1,500 / $3,500 / $7,500 MXN al mes según número de sucursales | **Plan del proveedor**: $499 / $999 / $1,999 MXN al mes |
| Bono de lealtad | **50 % del fee** devuelto en vales de gasolina/despensa o transferencia | $150 por cada 50 órdenes completadas |

No son dos versiones del mismo número: son dos negocios distintos conviviendo. El deck cobra
membresía a **empresas que consumen** servicios (restaurantes, hoteles, cadenas con
sucursales), mientras las specs cobran suscripción a **negocios que prestan** servicios. El
segmento B2B del deck no está modelado en ninguna parte, y el bono al 50 % del fee cambia por
completo la economía unitaria frente al bono fijo por volumen.

**Resolución adoptada en `08` D1–D4**: conviven la suscripción del proveedor y el segmento
corporativo consumidor, implementado como F7. Los porcentajes efectivos se congelan en cada
pago y el snapshot comparativo se define en `XC-26`.

### 4.2 La paleta de marca no es la del diseño web

El brandbook (slide 18) define Navy `#0D1B2A`, Gold `#C8A96E`, Cream `#F5F0E8` y Gray
`#8A9BB0`, con logo y taglines oficiales. El diseño web y todas las specs usan la paleta zinc
de shadcn (`#f4f4f5` / `#09090b`), y `F6` incluso pide explícitamente "sin gradientes de color
ajenos al diseño".

**Resolución adoptada en `08` D7**: landing con paleta de marca; dashboard/admin conservan
zinc. `F0-06` declara los tokens y F6 los consume solo en W1.

### 4.3 Las métricas de la landing ya no tienen que inventarse

`F6-findings` M6 objetaba que la landing mostrara cifras inventadas. El deck da cifras reales y
citables: 35 M de hogares en México, ~$350 000 M MXN de mercado anual, 95 % de informalidad,
500+ proveedores listos, CONAPO 2025 como fuente. Conviene usar estas y no las de marketing
ficticio.

## 5. Cambios ya materializados por el plan normativo

1. `F0-12` incorpora `Quote`, `LoyaltyBonus`, `BusinessDocument`, evidencia y campos ricos de
   `Worker`; mensajería queda futura por D5.
2. `F5-07`/`F5-09` consumen D6 sin convertirla en política de reembolso parcial.
3. `F6-02`/`F6-03` consumen D7–D8.
4. F7 implementa el dominio corporativo de D4; los bloqueos de Billing siguen en
   `PENDIENTES.md` §4.
