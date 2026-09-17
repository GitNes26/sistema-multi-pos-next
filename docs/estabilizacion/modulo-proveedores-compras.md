# Módulo de proveedores y compras

## Flujo cubierto

1. Registrar y mantener proveedores, contacto, condiciones de pago y tiempo de entrega.
2. Vincular productos o variantes con el SKU, costo, mínimo y preferencia del proveedor.
3. Crear una solicitud de cotización con vigencia y partidas.
4. Convertir la cotización en orden de compra sin volver a capturar sus productos.
5. Definir sucursal o CEDIS de destino, fecha esperada, costos e impuestos.
6. Aprobar la orden con un permiso independiente y marcarla como enviada.
7. Registrar una o varias recepciones parciales. Cada recepción valida el saldo pendiente.
8. Ingresar la mercancía en inventario, crear movimientos `purchase`, actualizar el costo de la variante y cerrar la orden cuando se reciba todo.

## Seguridad e integridad

- Todas las consultas y mutaciones se limitan a la organización activa.
- Los permisos `purchasing.view`, `purchasing.manage`, `purchasing.approve` y `purchasing.receive` separan responsabilidades.
- Productos, variantes, proveedor y destino se verifican en servidor.
- La recepción completa se ejecuta en una transacción serializable.
- No se admite recibir una cantidad superior a la pendiente.
- Cada entrada conserva folio, usuario, orden, partidas, costo y movimientos de inventario.

## Pruebas

Las pruebas unitarias cubren totales, impuestos, transiciones y cierre por recepción. La prueba sobre base desechable comprueba una recepción parcial seguida de otra completa, las existencias resultantes y los movimientos vinculados a cada comprobante.

La prueba `tests/purchasing.integration.test.mjs` ejecuta ese recorrido sobre la base demo aislada. El wizard `purchasing` acompaña el mismo flujo en la interfaz real mediante selectores `data-guide` estables.
