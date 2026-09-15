# Matriz de cobertura

Estados: pendiente, inspeccionado (solo código), probado, corregido sin verificar,
corregido y probado, bloqueado. No atribuir cobertura de navegador a lectura estática.

| ID | Área / actores | Escenarios obligatorios | Estado inicial |
|---|---|---|---|
| ENV-01 | Instalación mínima | Migraciones desde cero, seed mínimo, repetición, onboarding/primera venta | Migraciones y seed mínimo probados |
| ENV-02 | Demo / cinco modos | Sembrar/repetir; relaciones, estados e historial coherentes; QR estables | Seed demo probado; schema-diff vacío |
| AUTH-01 | Todos los roles | Login, logout, recuperación, sesión vencida, organización recordada | Login, permisos y multi-organización probados en suite HTTP; recuperación/sesión vencida pendiente |
| AUTH-02 | App/portal/invitado | Acceso cruzado por org y rol; sesión inválida; API directa | Aislamiento app/portal, roles, tenant y APIs directas probados; sesión inválida ampliada pendiente |
| POS-01 | Cajero/gerente | Caja, variante/granel, descuento/cupón, pagos, cambio, ticket, cierre | Probado en suite HTTP 25/25 |
| POS-02 | Cajero / cinco modos | Precios manipulados, referencias cruzadas, doble envío, stock concurrente | Manipulación, doble ronda, ciclo mesa y salida concurrente probados; doble envío de venta pendiente |
| INV-01 | Gerente | Movimientos, CEDIS, transferencias, revisión, devolución, stock | Salida concurrente, aislamiento, traslado sucursal→CEDIS, cierre único de revisión y reposición por devolución corregidos y probados |
| FOOD-01 | Mesero/cocina/cajero | Mesa/QR, rondas, KDS, servir, cobrar/cancelar, liberar | Probado en suite HTTP 25/25 |
| FOOD-02 | Cliente/invitado/anfitrión | Disponibilidad, reservas, códigos, espera, reasignación | Probado parcialmente; hardware/mensajería pendiente |
| PORTAL-01 | Cliente/preparador/repartidor | Carrito, entrega/recoger, pago, preparación, seguimiento, cancelación | Checkout, combos, idempotencia, seguimiento y cancelación probados por HTTP; inspección visual autenticada pendiente |
| PAY-01 | Proveedores webhook | Firma ausente/alterada, importe/moneda, tenant, duplicado, paidAt | Unitarias y typecheck; sandbox pendiente |
| SERV-01 | Agente atención | Asignación válida, conflicto, cancelada/no asistencia, cobro único | Creación/checkout concurrentes y estados alternativos probados; inspección visual completa pendiente |
| RENT-01 | Agente renta | Período/cantidad, conflicto, cancelación, cobro único | Disponibilidad/checkout concurrentes y estados alternativos probados; inspección visual completa pendiente |
| ADMIN-01 | Owner/gerente | Catálogos, empleados, roles, ajustes, promociones/publicaciones | CRUD, ajustes, organizaciones, usuarios, roles, menús y publicaciones corregidos; flujos operativos restantes pendientes |
| MONEY-01 | Gerente/cliente | Crédito, wallet, puntos, devoluciones, reversas y límites | Devolución con medio, importe, referencia, caja e idempotencia probada; reversa externa del proveedor pendiente |
| BI-01 | Gerente | Conciliar ventas/devoluciones y agregados; Excel/PDF | Conciliación, rotación, cohortes, lealtad, segmentación, márgenes, entregas, pares y pronóstico corregidos y probados por API; puntualidad bloqueada por falta de ETA persistida |
| EXT-01 | Servicios/hardware | Twilio, push, mapas, escáner, impresión 80mm | Pendiente; requiere verificación externa/física |

### Evidencia visual ejecutada

- `npm run test:e2e` con servidor de pruebas en `127.0.0.1:3107`: **9/9** pruebas `public-smoke` correctas en Chromium móvil, tablet y escritorio.
- Recorrido E2E ampliado: **39/39** pruebas en las mismas tres vistas; portal autenticado (inicio, tienda, pedidos y reservaciones) sin desbordamiento, superficies protegidas redirigen correctamente a acceso y el formulario de login enfoca el primer inválido y marca todos sus errores.
- Línea base de rendimiento HTTP registrada en `performance-baseline.json` para 11 rutas críticas sobre el servidor de pruebas; las primeras cargas incluyen compilación bajo demanda de Next.js y no representan una medición de producción.
- La primera ejecución sin servidor produjo `ERR_CONNECTION_REFUSED`; se conserva como bloqueo de entorno, no como defecto de interfaz.
- Inspección autenticada inicial: panel, POS, inventario y formulario de producto en Chromium compacto (654×856); se corrigió overflow del encabezado y se verificó foco inline al primer campo inválido. Falta repetir todos los recorridos en 360×800, 390×844, 768×1024, 1024×768 y 1366×768, además de Firefox/WebKit y hardware físico.
- Detector Impeccable del encabezado: 2 observaciones advisory de tipografía heredada (`impeccable-header.json`), sin errores bloqueantes; quedan para el lote de normalización tipográfica.
- KDS autenticado: antes del ajuste presentaba `scrollWidth=554` en 390×844; después del ajuste quedó en 390 px, sin overflow (`impeccable-kds.json` conserva avisos advisory y el rebote ya fue sustituido).
- Checkout: selector de propina adaptado a 3 columnas en móvil y objetivos `min-h-11`; detector registrado en `impeccable-checkout.json` sin observaciones. El aislamiento app/portal quedó verificado por HTTP; falta la inspección visual autenticada con contexto de cliente separado.
- Suite HTTP de integración ejecutada con base demo aislada: **27/27** casos correctos, incluyendo checkout confiable e idempotente, combos, cancelación concurrente con restitución de puntos, aislamiento app/portal, permisos por rol, mesa/KDS, entrega SSE, multi-organización, imágenes, lista de espera, reservación pública, rechazo de precio manipulado, inventario/devoluciones y ciclo completo de estados y concurrencia de agenda/rentas.

## Contrato de experiencia

Todos los recorridos principales: 360×800, 390×844, 768×1024, 1024×768,
1366×768. Chromium, Firefox y WebKit donde estén instalados. Registrar versión
y viewport en evidencia. Cada modo tiene al menos recorrido principal y rechazo
por rol; no multiplicar indiscriminadamente todas las combinaciones.

Escritorio: navegación persistente, teclado/foco/filtros. Tablet POS: catálogo y
ticket accesibles, táctil/orientación. Móvil: acciones principales al pulgar,
formularios legibles con teclado abierto. KDS: legibilidad a distancia y estados
no dependientes del color. Portal: compra breve, carrito y seguimiento persistentes.

Comprobar carga/vacío/error/éxito, texto largo, zoom 200%, temas/densidades,
áreas seguras, Atrás, scroll, trabajo sin guardar. Sin overflow de página;
tabla/mapa puede desplazar dentro de un contenedor identificado. Acciones táctiles
principales ≥44×44 CSS px. Emulación no certifica impresión ni tacto real.
