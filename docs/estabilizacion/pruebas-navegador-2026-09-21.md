# Pruebas de navegador — 21 de septiembre de 2026

## Entorno y alcance

- Base MySQL de prueba desechable `multi_pos_test_demo_1789146419404`, creada mediante `npm run test:prepare -- demo`. Se aplicaron todas las migraciones, incluidas las de intenciones de pago a crédito y uso de promociones por cliente. La base de desarrollo no se utilizó.
- Servidor de pruebas en `127.0.0.1:3107`.
- Playwright con Chromium emulado en 360×800, 390×844, 768×1024, 1024×768 y 1366×768.
- Suite previa: 39 casos correctos en los tres tamaños originales. Suite nueva: 20 casos correctos en los cinco tamaños.
- Ejecución conjunta posterior con dos trabajadores: 84 de 85 casos correctos. El caso restante creó el proveedor y cerró el diálogo, pero la lista no mostró el registro dentro de los 5 segundos de espera; al ejecutarlo de nuevo, aislado y con la misma base, pasó. La expectativa de visibilidad ahora admite hasta 30 segundos por la recarga del servidor de desarrollo. No se atribuye ese tiempo de espera a una falla funcional sin reproducirla.
- Ampliación del recorrido de compras y portal: 10 de 10 casos correctos, con un trabajador, en los cinco tamaños. Se usó la misma base de prueba desechable.
- Los mismos dos recorridos críticos pasaron en WebKit móvil (2 de 2). Firefox se instaló, pero el ejecutable falla al arrancar en Windows con «la configuración en paralelo no es correcta»; Playwright informa `browserType.launch: spawn UNKNOWN`. Se puede habilitar el proyecto `firefox-desktop` con `PLAYWRIGHT_FIREFOX=1` una vez corregido el runtime del host.
- La suite crítica ampliada ejecutó 36 casos: 33 pasaron y 3 detectaron apertura intermitente de productos desde la tarjeta arrastrable. Tras corregir la interacción, el recorrido del portal pasó en los cinco tamaños de Chromium y en WebKit móvil; en 360 px pasó además tres repeticiones consecutivas. Una corrida larga reinició el servidor Next de desarrollo por su umbral de memoria y cortó una prueba de WebKit antes de cargar; esa prueba pasó al repetirla con el servidor listo.

## Recorridos comprobados

| Superficie | Interacción observada | Resultado |
| --- | --- | --- |
| Acceso administrativo | Inicio de sesión del propietario demo | Permite abrir las pantallas protegidas |
| Proveedores | Foco al abrir, Enter con nombre vacío, error en campo, Enter con nombre válido y persistencia visible | Correcto tras corregir la validación del formulario |
| Compras | Cotización con validación vacía, cantidades/costo/impuesto, orden desde cotización, aprobación y recepción parcial de 1 de 2 unidades | Correcto en cinco tamaños tras corregir la conversión decimal; total mostrado y persistido: $29.00 |
| Publicaciones | Foco inicial, Enter con título vacío, error en campo y cambio de color primario del flyer | Correcto |
| Productos | Enter con datos vacíos, campos inválidos y foco en el primero | Correcto |
| Acceso del portal | Foco inicial, Enter vacío, errores de campo y ausencia de desbordamiento horizontal | Correcto tras corregir el foco inicial |
| Tienda y checkout del portal | Abrir producto, comprobar descripción, agregar al carrito, avanzar con Enter en el control de deslizamiento y cargar métodos de pago | Correcto en cinco tamaños; botón de confirmación visible encima de la barra inferior |
| Rutas públicas y protegidas | Acceso, redirecciones y desbordamiento del portal de la suite existente | 39 casos correctos |

Las capturas de cada caso se generan en `test-results/critical-ux-*/` durante la ejecución. Se inspeccionaron las capturas de 360 px de proveedor, publicación, producto y acceso del portal; los campos y acciones son visibles. Las capturas se regeneran al volver a ejecutar Playwright y no constituyen un registro permanente.

## Hallazgos y correcciones

- **NAV-01 — Proveedor, P2, confirmado y corregido.** Al presionar Enter con el nombre vacío, el botón deshabilitado impedía ver el error. El formulario ahora valida el nombre, marca el campo inválido y lo enfoca; Enter con datos válidos crea el proveedor.
- **NAV-02 — Acceso del portal, P2, confirmado y corregido.** El primer campo no recibía foco al abrir. Se añadió foco inicial y la prueba comprueba también la validación vacía.
- **NAV-03 — Compras, P1, confirmado y corregido.** Al crear una orden desde una cotización con 2 unidades a $12.50 e impuesto 0.16, la vista mostraba $254.00 en lugar de $29.00. Prisma entregaba los decimales como texto y la suma `1 + taxRate` concatenaba cadenas. Se normalizan los importes al cargar la cotización y se convierte explícitamente en el total mostrado. La prueba confirma también el total persistido.
- **NAV-04 — Checkout móvil, P2, confirmado y corregido.** La acción «Confirmar pedido» quedaba parcialmente detrás de la navegación inferior. Se desplazó la acción fija por encima de esa barra y Playwright compara sus posiciones reales.
- **NAV-05 — Tienda móvil, P1, confirmado y corregido.** El toque sobre el nombre de un producto dentro de la tarjeta arrastrable no siempre abría el detalle. La tarjeta ahora distingue un toque breve de un gesto de arrastre y abre el detalle sin activar las acciones internas; el enlace conserva su activación por teclado. Se repitió el recorrido de producto, carrito y checkout en todos los tamaños y en WebKit móvil.

## Verificación de cierre del lote

- `npm run typecheck`: correcto.
- ESLint en los archivos modificados en este lote: sin errores ni advertencias.
- `npm test`: 54 pruebas correctas.
- `npm run build`: compilación de producción correcta, con advertencias preexistentes de lint en otros archivos.
- Portal producto → carrito → checkout: correcto en los cinco tamaños de Chromium y WebKit móvil tras NAV-05. La corrida larga inicial quedó en 33/36 porque el fallo de toque se reprodujo en tres tamaños antes de la corrección; no se presenta esa corrida como aprobada.

## Límites de esta pasada

Estas pruebas no cubren todos los formularios. En compras se validó una ruta correcta hasta recepción parcial; faltan rechazo de permisos, errores de servidor, recepción excedida y devolución/cancelación. En el portal se llegó al checkout y se comprobaron sus controles, pero no se confirmó un pedido ni se ejecutó un cobro externo. Firefox sigue bloqueado por el runtime del host; WebKit se comprobó solo en móvil. No se probaron dispositivos físicos: la emulación no valida teclado virtual, tacto real, lector ni impresión. Se deben completar esos recorridos antes de afirmar validación integral de UX o pagos.

## Comandos

```powershell
npm run test:prepare -- demo
npm run test:serve -- demo
npm run test:e2e -- demo
npm run typecheck
npm run lint
```
