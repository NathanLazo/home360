# Guion de QA — datos demo (home360.lat)

Contraseña de todas las cuentas: la del seed demo. Montos en MXN.
Orden sugerido: cada bloque usa **dos teléfonos/sesiones** (cliente en la app + negocio en web o técnico en la app) para ver ambos lados del mismo flujo.

## 1. Cotizar → aceptar → pagar (escrow)
1. **App · cliente.ana** → Solicitudes → "Fuga debajo del fregadero": debe mostrar 1 cotización de Plomería Express Norte ($650, técnico Luis) y la de Ferretería La Llave como **retirada** (no aceptable).
2. "El minisplit no enfría y gotea agua": 2 cotizaciones (Clima Total $950 · ElectroHogar $1,200). Compáralas y **acepta Clima Total**.
3. Paga con tarjeta de prueba de Stripe → la orden debe quedar **Pagada / en custodia**.
4. **Web · negocio.clima-total** → debe aparecer la orden nueva pagada; KPIs se mueven; el dinero sale como **retenido**, no disponible.
5. **Web · negocio.electrohogar** → su cotización perdida debe verse rechazada/cerrada, sin errores.

## 2. Ejecución del servicio con técnico (evidencia grabada)
1. **App · tecnico.carmen** (Limpieza Brillante) → orden de Elena "Limpieza profunda" (Pagada). Inicia servicio, graba evidencia, termina.
2. **App · cliente.elena** → misma orden: el chat con mensajes previos se ve; confirma la entrega.
3. **Web · negocio.limpieza-brillante** → la orden pasa a Completada y el pago de retenido → liberado (según regla de PENDIENTES.md).
4. Revisa que el técnico "fuera de turno" (Alma) **no** se pueda asignar.

## 3. Orden en curso
1. **App · cliente.miguel** → "Impermeabilización de azotea" en curso ($4,200, Pinturas Sierra, técnico Iván). Ojo: el técnico es **tecnico.ivan@demo.home360.lat**, que no está en tu lista.
2. **App · tecnico.ivan** → terminarla con evidencia. **Web · negocio.pinturas-sierra** → verla pasar a completada.
3. Miguel tiene además una **orden pendiente de pago** (Cerrajería 24/7, apertura de puerta): págala o cancélala y confirma que **negocio.cerrajeria-24** ve el cambio.

## 4. Solicitudes abiertas, dirigidas y expiradas
1. **App · cliente.valeria** → "Pasto crecido y árboles sin podar" (dirigida solo a Jardines del Desierto).
2. **Web/App · negocio.jardines-desierto** → la ve y la cotiza. **Con otro negocio (p. ej. plomeria-norte) NO debe verse.**
3. **App · cliente.carlos** → "Contactos sin corriente" abierta: un negocio eléctrico (electrohogar) la cotiza, Carlos la ve llegar. Su solicitud "chapa trabada" debe verse cancelada con la cotización expirada.
4. **App · cliente.elena** → "El boiler no calienta": expirada, sin poder aceptar nada.

## 5. Productos y envíos
| Cliente | Producto | Negocio | Estado esperado | Qué probar |
|---|---|---|---|---|
| elena | Taladro percutor | Ferretería La Llave | En camino | Chat iniciado por la cliente; negocio marca entregado → cliente confirma |
| valeria | Manguera 15 m | Jardines del Desierto | En camino | Mismo cierre de entrega |
| ana | Focos LED | ElectroHogar | Pagada | Negocio la despacha → En camino |
| ana / carlos / miguel | desarmadores / filtro / vinílica | varios | Completadas con reseña | Reseña visible en el negocio |

Además en **app · cliente.ana**: comprar el producto **agotado** de Plomería Norte (no debe dejar), y uno de **stock bajo** de Ferretería La Llave. Probar con sus 2 direcciones (envío vs recolección; La Llave tiene una sucursal sin envío).

## 6. Reseñas y cancelaciones
- **cliente.carlos**: servicio completado con reseña de 4★ (Clima Total) → visible en el perfil del negocio.
- **cliente.valeria**: orden cancelada (poda) → sin cobro, sin reembolso pendiente raro.
- **cliente.ana**: servicio completado (fuga) → dejar reseña si aún no tiene.

## 7. Técnicos (app)
| Cuenta | Negocio | Qué validar |
|---|---|---|
| tecnico.luis | Plomería Express Norte | Solo ve órdenes de su negocio; orden completada de Ana |
| tecnico.sofia | ElectroHogar | Cotización del minisplit; servicio completado de Valeria |
| tecnico.ramon | Clima Total | Orden nueva del flujo 1 (si se aceptó) |
| tecnico.carmen | Limpieza Brillante | Flujo 2 completo |
| tecnico.ivan | Pinturas Sierra | Flujo 3 |

## 8. Panel web por negocio (lo que tiene que cuadrar)
- **plomeria-norte** (Estándar): 2 sucursales, producto agotado marcado.
- **electrohogar** (Empresarial): 3 sucursales (una pausada, una sin recolección), servicio pausado, producto en borrador (no visible en la app), invitación de técnico pendiente (Andrés).
- **ferreteria-llave** (Básico): solo 8 productos, alertas de stock bajo/agotado; intentar exceder límites del plan Básico (1 sucursal / 3 trabajadores) → debe salir `PLAN_LIMIT_REACHED` traducido, no un error crudo.
- **fumigaciones** (PENDIENTE): al entrar no debe operar; en **admin** aparece en la cola de aprobación → aprobar → ya entra normal.

Checklist en cada pantalla: sin pantallas en blanco, sin textos de clave (`dashboard.foo`), es/en completos, estados vacío/carga/error correctos.
