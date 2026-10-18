# Inspección como dueño y cliente nuevos: mejoras de flujo

Fecha: 17 de octubre de 2026 · Versión probada: 0.45.0.0 (entorno local, empresa «NESSIK Test»).

## Cómo se hizo la inspección

Recorrí el sistema en un navegador, sin leer manuales, como alguien que abrió su tiendita este mes y apenas sabe usar computadoras:

1. **Dueño:** panel, catálogo (alta de un producto), POS (venta, apertura y corte de caja), inventario, compras, empleados, nómina, plan, reportes.
2. **Cliente nuevo del portal:** pantalla de entrada, registro, recorrido de bienvenida, tienda, carrito, pago y seguimiento del pedido (en vista de teléfono).

Límites de la prueba: usé la empresa de pruebas, que ya traía datos, así que no vi el panel completamente vacío. No probé hardware (impresora, báscula, escáner), pagos en línea, correo ni WhatsApp. Tampoco recorrí mesas/KDS, agenda, reservaciones, combos, promociones, créditos ni lealtad más allá de lo que se ve en el portal.

## Lo que ya se corrigió durante la inspección

| # | Problema encontrado | Efecto para el dueño | Arreglo |
|---|---|---|---|
| C1 | Vender un producto a granel que quedó sin unidad guardada fallaba con «La unidad seleccionada no está disponible para este producto» y luego con «Error al registrar la venta» (llave foránea de `unitId`). | No se podía cobrar el frijol a granel; el mensaje no decía qué hacer. | `resolveBulkUnitPrice` acepta el granel sin unidad usando el precio base, y la venta guarda `unitId` nulo en vez de vacío (`src/lib/pos/bulk-pricing.ts`, `src/lib/pos/server.ts`). |
| C2 | El resumen de caja decía «0 ventas hoy · $0.00» y «Esperado en caja $0.00» con una venta hecha y $200 de fondo. | El corte de caja mostraba cifras falsas, justo la pantalla donde más se confía en el sistema. | El panel pide los datos de la sucursal del POS y no de una sucursal por defecto (`src/components/pos/cash-register-panel.tsx`). Ahora muestra $237.12 esperados. |

Verificado: las ventas posteriores se registran y el corte cuadra («Cuadre correcto, sin discrepancias»). Typecheck, lint y 71 pruebas pasan. Falta una prueba automática que cubra el granel sin unidad.

Pendiente de datos: los productos a granel sembrados en la empresa de pruebas tienen `bulkUnitId` nulo (por eso el inventario los muestra en «pza» y no en «kg»). Conviene que el seeder les asigne Kilogramo.

## Estado de implementación (18 oct 2026)

| Punto | Estado |
|---|---|
| P0-1 Producto en $0 | Hecho: el precio es obligatorio al crear algo en venta. |
| P0-2 Gastos y ganancia | Hecho: módulo Gastos, retiro de caja con motivo, pantalla Ganancias y costo guardado en cada venta. |
| P0-3 Costo del producto | Hecho: el formulario lo explica («para calcular tu ganancia»), el panel avisa cuántos productos no tienen costo y las compras recibidas actualizan el costo (variantes y granel). |
| Stock inicial y stock mínimo al crear el producto | Hecho (no estaba en la lista original; lo pidió el equipo). |
| Cliente antes de cobrar con lealtad activa | Hecho. |
| Asistentes (wizards) | Actualizados: producto (precio, existencias y mínimo) y nuevo «Anota tus gastos y mira tu ganancia». |

Los demás puntos siguen pendientes.

## Mejoras propuestas, por prioridad

Leyenda: **Impacto** en el dueño o cliente nuevo; **Esfuerzo** S (horas), M (1–3 días), L (más de 3 días).

### P0: riesgo de perder dinero o confianza

1. **Un producto puede nacer en $0.00, sin categoría y «en venta».** Creé «Galletas Marías» solo con el nombre y quedó visible en el POS y en el portal público con precio $0.00. Propuesta: precio obligatorio al crear con «Disponible para venta» activo (o crear como borrador si falta el precio), aviso claro y excluir de portal y POS lo que cueste $0. Impacto alto · Esfuerzo S.
2. **No existe el concepto de gastos ni de utilidad.** El dueño quiere saber «mi ganancia». Hoy solo hay ventas y «margen bruto estimado» (que depende de costos que él nunca capturó). No hay retiros de caja por gasto, renta, servicios, ni estado de resultados. Propuesta: módulo «Gastos» (categoría, monto, fecha, quién, comprobante, pagado de caja o aparte) y una vista «¿Cómo me fue este mes?»: ingresos − costo de lo vendido − gastos = ganancia, con comparación con el mes anterior. Impacto muy alto · Esfuerzo L.
3. **El costo del producto es opcional y se pide sin explicar para qué.** Sin costo, el margen del panel es 0 % y parece un error. Propuesta: texto de ayuda («con esto calculamos tu ganancia»), aviso en el panel («3 productos sin costo») y captura de costo al recibir compras. Impacto alto · Esfuerzo S–M.

### P1: bloqueos en el primer día de uso

4. **Cobrar sin caja abierta falla al final.** Se arma el ticket, se elige el pago y solo entonces aparece, en texto rojo pequeño, «No hay sesión de caja abierta», sin botón para abrirla ahí mismo. Propuesta: al tocar «Cobrar» (o al agregar el primer artículo) mostrar «Para vender, abre tu caja» con un botón «Abrir caja» y recordar el ticket. Impacto alto · Esfuerzo S.
5. **Jerga sin explicación.** «Fondo inicial en caja», «Corte», «Caja registradora», «Bajo mínimo», «Híbrido», «Constructor de producto», «BI», «Puestos», «Medidas», «CEDIS», «KDS». Propuesta: una línea de ayuda bajo cada término («El dinero con el que empiezas el día para dar cambio»), renombrar «Bajo mínimo» a «Por agotarse», «BI» a «Análisis», «Medidas» a «Unidades de medida», y un glosario accesible desde el signo de interrogación. Impacto alto · Esfuerzo S.
6. **El panel inicial abruma.** Trece tarjetas de arranque a la vez, un «tipo de negocio» técnico («Híbrido: se activan todas las herramientas») y seis indicadores en cero. Propuesta: mostrar solo los 3 siguientes pasos según lo que ya hizo («Pon precio a 1 producto», «Abre tu caja», «Haz tu primera venta»), ocultar el resto bajo «Ver más» y preguntar el giro con lenguaje de negocio («¿Qué vendes?»). Impacto alto · Esfuerzo M.
7. **35 opciones en el menú lateral.** Un dueño de tiendita no necesita CEDIS, KDS, agenda, reservaciones ni nómina el primer día. Propuesta: menú «Básico» por defecto (Panel, Vender, Productos, Inventario, Clientes, Reportes, Ajustes) y «Más herramientas» que se despliega; las áreas fuera del plan deben salir del menú o llevar candado explicativo. Impacto alto · Esfuerzo M.
8. **Pantallas que redirigen en silencio.** `/admin/payroll` devuelve al Panel sin mensaje aunque «Nómina» aparece en el menú; un empleado que abre el portal es llevado al POS sin explicación. Propuesta: pantalla «No tienes acceso a esto» con el motivo (permiso o plan) y botón para pedirlo; ocultar del menú lo que no se puede abrir. Impacto medio · Esfuerzo S.
9. **Errores genéricos.** «Error al registrar la venta» no dice si fue la red, un dato o el servidor. Propuesta: mensajes por causa conocida y, en el resto, «No se pudo guardar la venta. No se perdió nada, reintenta» con un código de soporte. Impacto medio · Esfuerzo S–M.
10. **Contratar plan solo por WhatsApp y sin autoservicio.** La landing no ofrece «Crear mi negocio» y la configuración inicial depende de que alguien lo dé de alta. Propuesta: alta en autoservicio con prueba gratuita o, al menos, una guía «qué pasará después de escribirnos». Impacto medio · Esfuerzo L.

### P2: fricciones que se notan pronto

11. **Compras en cuatro pasos para una tiendita** (proveedor → cotización → orden → recepción). Existe «Captura rápida» en inventario, pero el dueño no sabrá cuál usar. Propuesta: botón «Llegó mercancía» que registre compra y entrada en un paso y actualice el costo; dejar el flujo largo para quien lo necesite. Impacto alto · Esfuerzo M.
12. **Inventario sin conteo guiado.** Hay «Revisiones físicas» pero no un asistente «cuenta tu tienda». Propuesta: modo conteo por pasillo/categoría con teclado numérico grande y resumen de diferencias antes de ajustar. Impacto medio · Esfuerzo M.
13. **El granel se muestra en «pza».** Inventario y alta de producto no dejan claro «kg/litros» para los productos heredados. Propuesta: mostrar la unidad real y migrar datos antiguos. Impacto medio · Esfuerzo S.
14. **Corte de caja:** el diálogo ya muestra lo esperado antes de contar (no es conteo ciego) y la hoja de resultado muestra «-$0.00» en cambio y reembolsos. Propuesta: opción de conteo ciego y no mostrar signos en cero. Impacto bajo · Esfuerzo S.
15. **Impresión y ticket:** el ticket está bien resuelto (QR, desglose), pero el selector «Papel de la impresora 58/80 mm» aparece dentro del ticket; no verifiqué si recuerda la elección. Propuesta: confirmar que se recuerde por equipo. Impacto bajo · Esfuerzo S.
16. **Barra superior del POS con muchos iconos sin texto** (calendario, guía, báscula, notificaciones, salir). Propuesta: etiquetas visibles en pantallas anchas y agrupar lo poco usado en «Más». Impacto medio · Esfuerzo S.
17. **Plan y límites poco claros.** «Mi plan» muestra «2 / 325 empleados» y una lista de lo que no incluye que puede quedar desactualizada hasta volver a sembrar planes. Propuesta: mostrar solo lo que el dueño usa («Te quedan 3 empleados») y generar la lista de inclusiones desde los permisos reales. Impacto bajo · Esfuerzo S.

### Portal del cliente nuevo

18. **Se muestran promociones vencidas.** En el inicio aparecieron «10 % en bebidas» y «$20 menos…» con fechas del 26–27 de septiembre cuando hoy es 17 de octubre. Propuesta: filtrar por vigencia en el servidor y mostrar «Termina hoy / en 3 días». Impacto alto · Esfuerzo S.
19. **Producto en $0.00 y «Agotado» a la vista del público** (ver punto 1). Impacto alto · Esfuerzo S.
20. **Tocar «Continuar al pago» no da respuesta durante varios segundos** (cierra la hoja y se queda en la tienda hasta que carga el pago; en modo desarrollo tardó más). Propuesta: estado de carga inmediato en el botón y prefetch de la ruta. Impacto medio · Esfuerzo S.
21. **El carrito se pierde al recargar la página** (volvió a «0 productos»). Propuesta: persistir el carrito por tienda y cuenta. Impacto medio · Esfuerzo S.
22. **«Desliza para confirmar»** es poco intuitivo para quien nunca lo ha usado y su texto queda recortado en teléfonos de 375 px. Propuesta: botón «Confirmar pedido» con confirmación de dos pasos o el deslizador solo como opción; revisar el recorte. Impacto medio · Esfuerzo S.
23. **Precios sin impuestos incluidos.** $46.00 en la tienda pasa a $53.36 en el carrito. Propuesta: mostrar precio final con IVA incluido (configurable) o una leyenda «+ IVA» junto a cada precio. Impacto alto · Esfuerzo S–M.
24. **Iconos del encabezado sin texto** (edificio, carrito, campana, monitor) y nombre de la tienda truncado («NESSIK T…»). Propuesta: etiquetas accesibles visibles al mantener pulsado y nombre en dos líneas. Impacto bajo · Esfuerzo S.
25. **Registro sin contraseña (activación por enlace):** simple, pero el texto no dice qué sigue. Propuesta: pantalla de éxito «Revisa tu correo/teléfono para activar» con reenvío. Impacto medio · Esfuerzo S.

## Lo que ya funciona bien (conservar)

- Formulario de producto con tipos explicados con ejemplos («Producto, A granel, Personalizado, Servicio»).
- Venta a granel con atajos de cantidad (¼, ½, 1 kg) y opción de báscula.
- Cobro con efectivo/tarjeta en un toque, propinas y denominaciones.
- Ticket con desglose, QR del portal y resumen de corte claro.
- Recorrido de bienvenida del portal con «Saltar», estados de carga con esqueletos, y explicación junto al crédito deshabilitado.
- Seguimiento del pedido del cliente creado correctamente de punta a punta.

## Orden sugerido de trabajo

1. **Esta semana (S):** puntos 1, 4, 5, 8, 18, 20, 21, 23.
2. **Siguiente (M):** 3, 6, 7, 11, 12.
3. **Estratégico (L):** 2 (gastos y ganancia) y 10 (alta en autoservicio).

El análisis de la carga de menús con IA está en [`IMPORTACION_IA_MENU.md`](IMPORTACION_IA_MENU.md).
