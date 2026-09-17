# Auditoría de importaciones masivas

Fecha: 2026-09-17

## Cobertura

| Superficie | Identificación | Dependencias | Vista previa | Resultado |
|---|---|---|---|---|
| Categorías | Nombre | Categoría padre | Errores por fila | Bloquea nombres existentes o repetidos |
| Clientes | Nombre; código opcional | Cuenta del Portal | Errores por fila | Valida teléfono, correo, puntos y duplicados |
| Productos | Nombre, SKU o código según tipo | Categoría y unidades | Errores por fila | Valida estándar/granel y campos condicionales |
| Inventario | SKU, código o nombre de granel | Producto y ubicación | Resumen válido/inválido | Reemplaza existencia final después de confirmar |

Solo estos catálogos exponen actualmente una acción de importación masiva. Medidas,
sucursales, empleados, puestos, promociones y demás catálogos no muestran esa acción y
por tanto no se presentan como importables.

## Contrato de archivo

- Solo `.xlsx`, máximo 10 MB y firma ZIP válida.
- Máximo 5,000 filas; el importador de catálogos limita también las columnas.
- Los encabezados pueden cambiar de orden, pero no duplicarse ni omitir los requeridos.
- Las plantillas incluyen instrucciones y listas de categorías/unidades en una hoja
  auxiliar oculta, evitando el límite de longitud de las listas inline de Excel.
- La importación se bloquea mientras exista una fila inválida. La revisión no escribe
  datos.

## Casos comprobados automáticamente

- Booleanos en español y valores no reconocidos.
- Números vacíos, decimales e inválidos.
- Correo y teléfono opcionales con formato correcto e incorrecto.
- Categoría padre inexistente.
- Categoría, SKU, código, teléfono, correo o número de cliente duplicado.
- Producto estándar con tipo, categoría, precio o costo inválido.
- Producto a granel sin unidad, con incremento cero o fraccionamiento incompleto.
- Precio autorizado para unidad principal y presentación dividida del POS.

## Comprobaciones de integración pendientes de entorno

Ejecutar sobre la base desechable de integración los cuatro archivos generados por el
sistema: lote completamente válido, encabezados reordenados, lote con errores y lote de
5,000 filas. Confirmar conteos antes/después, movimientos de inventario y ausencia de
escrituras durante la vista previa. No ejecutar estas pruebas sobre datos reales.
